# Build targets for `sam build` (BuildMethod: makefile).
#
# Functions: SAM copies CodeUri (../backend) to a scratch dir and runs the target there, so
# "." is the backend package; we place it at $(ARTIFACTS_DIR)/backend.
# Layer: installs manylinux wheels for the Lambda runtime into $(ARTIFACTS_DIR)/python.

LAMBDA_PY := 3.11
UV := $(shell command -v uv 2>/dev/null)

ifdef UV
INSTALL_LAYER = uv pip install --quiet --target "$(ARTIFACTS_DIR)/python" \
	--python-platform x86_64-manylinux2014 --python-version $(LAMBDA_PY) --only-binary :all: -r requirements-lambda.txt
else
INSTALL_LAYER = python3 -m pip install --quiet --target "$(ARTIFACTS_DIR)/python" \
	--platform manylinux2014_x86_64 --implementation cp --python-version $(LAMBDA_PY) \
	--only-binary=:all: -r requirements-lambda.txt
endif

define copy_backend
	mkdir -p "$(ARTIFACTS_DIR)/backend"
	cp -R . "$(ARTIFACTS_DIR)/backend"
	find "$(ARTIFACTS_DIR)/backend" -name "__pycache__" -type d -prune -exec rm -rf {} +
endef

build-DepsLayer:
	$(INSTALL_LAYER)

build-ApiFunction:
	$(copy_backend)

build-IngestFunction:
	$(copy_backend)

build-TickFunction:
	$(copy_backend)

build-DigestFunction:
	$(copy_backend)

build-EscalationStepFunction:
	$(copy_backend)
