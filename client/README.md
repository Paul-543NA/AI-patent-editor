# Patent Editor UI

## Layout

Application code is in the `src/` directory.

```
src
├── App.tsx                          # Main app shell (layout, toolbar, suggestions panel)
├── main.tsx                         # React entry point
├── contexts
│   └── AppContext.tsx               # Central state management (documents, versions, AI suggestions, upgrade)
├── internal
│   ├── Document.tsx                 # Editor wrapper with WebSocket connection
│   ├── Editor.tsx                   # TipTap rich-text editor component
│   ├── SuggestionCard.tsx           # AI suggestion display card (severity-coloured)
│   ├── LoadingOverlay.tsx           # Spinner overlay for loading states
│   ├── PatentSelector/              # Modal for switching between patent documents
│   ├── VersionSelector/             # Modal for viewing and switching document versions
│   └── UpgradeProgressOverlay/      # Real-time upgrade progress visualisation
```

## Running locally

```sh
npm install
npm run dev
```
