import React from "react";
import { BrowserRouter } from "react-router-dom";

export function App(): React.ReactElement {
  return (
    <BrowserRouter>
      <div className="min-h-screen p-4">
        <h1 className="text-2xl font-bold tracking-tight">Saathi</h1>
        <p className="text-sm text-stone-500">Elder-care guardian on Ring</p>
      </div>
    </BrowserRouter>
  );
}
