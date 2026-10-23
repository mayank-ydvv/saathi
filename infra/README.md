# Saathi on AWS (SAM)

One stack: 4 DynamoDB tables (contract 4.5, on-demand), a private S3 bucket (snapshots, audio,
digests; presigned URLs), an HTTP API, five Lambdas, two EventBridge schedules, the escalation
state machine, and an SNS topic.

| Lambda | Trigger | Code |
|---|---|---|
| `ApiFunction` | HTTP API `ANY /{proxy+}` | FastAPI via Mangum (`backend/handlers/api.py`) |
| `IngestFunction` | HTTP API `POST /webhooks/ring` | `backend/handlers/ingest.py` |
| `TickFunction` | `rate(1 minute)` | rollover + late-start / inactivity checks |
| `DigestFunction` | `cron(30 15 * * ? *)` = 21:00 IST | Bedrock evening digest |
| `EscalationStepFunction` | each `waitForTaskToken` Task | `run_step` (see [docs/ESCALATION.md](../docs/ESCALATION.md)) |

Each function's IAM policy lists only the actions it uses, on the named tables, the bucket and the
topic. DynamoDB `Scan` is granted to none of them.

## Build and deploy

Prerequisites: AWS credentials (`aws configure` or env vars), the SAM CLI
(`uv tool install aws-sam-cli` or `brew install aws-sam-cli`), `make`, and `uv` or `pip`.
Bedrock model access must be enabled in the console for the model you pass as `BedrockModelId`.

```bash
cd infra
sam build                 # functions = backend/ only; layer = manylinux wheels from requirements-lambda.txt
sam deploy --guided       # first time: stack name saathi, region us-east-1, answer the parameters
```

`sam deploy --guided` stores your answers in `infra/samconfig.toml` (git-ignored, because it can
hold the NoEcho values you typed). Later deploys are just `sam build && sam deploy`.

Parameters: `RingWebhookHmacKey` (required), `ParentDeviceToken` (required, 16+ characters:
the parent app sends it as `VITE_DEVICE_TOKEN`), `FamilyEmails` (comma-separated: the only
accounts allowed to read the home), `AllowedOrigins` (the deployed dashboard, parent app and
landing origins for CORS), `RingApiBase`, `RingToken`, `TelegramBotToken`,
`TelegramWebhookSecret`, `TelegramFamilyChatId`, `TelegramNeighbourChatId`, `BedrockModelId`,
`DemoMode` (default `false`; `true` = 10/15/20 s ladder waits for filming, nothing else),
`AlertEmail` (optional SNS email subscription).

The API checks every request: the dashboard sends the family member's Cognito id token, the
parent tablet its device token. After the first deploy, re-run `scripts/seed_home.py` with
`FAMILY_EMAILS` set so the home record lists who may read it.

Check it's up:

```bash
curl "$(aws cloudformation describe-stacks --stack-name saathi \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)/health"
# {"ok":true}
```

## Family login (Cognito)

The stack also creates the `saathi-family` Cognito user pool. Cognito emails the verification
and password-reset codes itself (default sender, `no-reply@verificationemail.com`; Cognito's
default email allows about 50 emails a day, plenty for the hackathon). Point the dashboard at it:

```bash
aws cloudformation describe-stacks --stack-name saathi \
  --query "Stacks[0].Outputs[?OutputKey=='CognitoRegion' || OutputKey=='FamilyUserPoolClientId']"
# put them in dashboard/.env as VITE_COGNITO_REGION and VITE_COGNITO_CLIENT_ID
```

## Seed the home

Seeding writes straight to DynamoDB from your laptop, using the Ring device list:

```bash
STORAGE=dynamo AWS_REGION=us-east-1 python scripts/seed_home.py \
  --routines sandbox/fixtures/routines_home-demo-1.json
```

## Point Ring / ring-sandbox at the deployed webhook

```bash
WEBHOOK=$(aws cloudformation describe-stacks --stack-name saathi \
  --query "Stacks[0].Outputs[?OutputKey=='RingWebhookUrl'].OutputValue" --output text)
ring-sandbox serve --port 8787 &
ring-sandbox webhook "$WEBHOOK" --key "<the RingWebhookHmacKey you deployed with>"
ring-sandbox play <scenario.yml>
```

The emulator signs and delivers webhooks to the URL above. For doorbell snapshots, the Lambda has
to reach the Ring API: with a Ring Playground token use the default `RingApiBase`
(`https://api.amazonvision.com`). The local emulator is only reachable from Lambda through an
HTTPS tunnel (e.g. `cloudflared tunnel --url http://localhost:8787`), and `RingClient` refuses
plain `http://` except for localhost.

## Telegram button on AWS

Lambda can't long-poll, so the stack runs with `TELEGRAM_MODE=webhook`. Register the webhook
once, with the same secret you deployed:

```bash
TG=$(aws cloudformation describe-stacks --stack-name saathi \
  --query "Stacks[0].Outputs[?OutputKey=='TelegramWebhookUrl'].OutputValue" --output text)
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=$TG" -d "secret_token=<TelegramWebhookSecret>" -d 'allowed_updates=["callback_query"]'
```

`deleteWebhook` switches the bot back to long polling for local runs.

## Cost (stays at a few cents for the hackathon)

| Service | Usage | Cost |
|---|---|---|
| Lambda | ~43,200 tick invocations/month + API calls | inside the 1M free requests |
| EventBridge schedules | 2 rules | free |
| Step Functions (Standard) | ~5 transitions per alert | inside the 4,000 free transitions/month |
| DynamoDB on-demand | a few thousand reads/writes a day | < $0.10/month |
| S3 | a few MB of snapshots/audio (snapshots expire after 30 days) | ~free |
| HTTP API | demo traffic | inside the free tier (first 12 months) |
| Polly neural | one sentence, cached by text | inside the free tier (first 12 months) |
| Bedrock | one digest/day + visitor descriptions | a few cents per day of demos |

## Tear down after the hackathon

```bash
aws s3 rm "s3://$(aws cloudformation describe-stacks --stack-name saathi \
  --query "Stacks[0].Outputs[?OutputKey=='BlobBucketName'].OutputValue" --output text)" --recursive
sam delete --stack-name saathi
```

The bucket has to be emptied first; `sam delete` removes everything else, including the tables
(and their data).
