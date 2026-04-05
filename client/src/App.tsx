import Document from "./internal/Document";
import LoadingOverlay from "./internal/LoadingOverlay";
import UpgradeProgressOverlay from "./internal/UpgradeProgressOverlay";
import Logo from "./assets/logo.png";
import VersionSelector from "./internal/VersionSelector";
import PatentSelector from "./internal/PatentSelector";
import SuggestionCard from "./internal/SuggestionCard";
import { AppContextProvider, useAppContext } from "./contexts/AppContext";

function AppContent() {
  const {
    currentDocumentId,
    isLoading,
    savePatent,
    upgradeDocumentAutomatically,
    suggestions,
    removeSuggestion,
    clearSuggestions,
    isReceivingAiSuggestions,
    upgradeUpdates,
    isUpgrading,
  } = useAppContext();

  return (
    <div className="flex flex-col h-full w-full">
      {isLoading && !isUpgrading && <LoadingOverlay />}
      {isUpgrading && <UpgradeProgressOverlay updates={upgradeUpdates} isVisible={isUpgrading} />}
      <header className="flex items-center justify-center top-0 w-full bg-black text-white text-center z-50 mb-[30px] h-[80px]">
        <img src={Logo} alt="Logo" style={{ height: "50px" }} />
      </header>
      <div className="flex w-full bg-white h=[calc(100%-100px) justify-center box-shadow ">
        <div className="flex flex-col lg:flex-row w-full max-w-7xl gap-4">
          <div className="flex flex-col h-full items-center gap-2 px-4 flex-1">
            <div className="flex justify-between items-center w-full">
              <PatentSelector />
              <VersionSelector />
            </div>
            <Document />
          </div>
          <div className="flex flex-col h-full items-start gap-2 px-4 w-full lg:w-80">
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 w-full">
            <button 
              onClick={() => savePatent(currentDocumentId)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              Save
            </button>
            <button 
              onClick={upgradeDocumentAutomatically}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={isLoading || isUpgrading}
            >
              {isUpgrading ? "Upgrading..." : "Upgrade text automatically"}
            </button>
          </div>
          
          {/* Suggestions Section */}
          <div className="w-full mt-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-[#213547]">AI Suggestions</h3>
              {suggestions.length > 0 && (
                <button
                  onClick={clearSuggestions}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Clear All
                </button>
              )}
            </div>
            <div className="space-y-2">
              {suggestions.length === 0 ? (
                isReceivingAiSuggestions ? (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                    <span>AI is analyzing your text...</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    Start typing to receive AI suggestions.
                  </p>
                )
              ) : (
                suggestions.map((suggestion, index) => (
                  <SuggestionCard
                    key={index}
                    data={suggestion}
                    onClose={() => removeSuggestion(index)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

function App() {
  return (
    <AppContextProvider>
      <AppContent />
    </AppContextProvider>
  );
}

export default App;
