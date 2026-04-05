import { useVersionSelector } from "./useVersionSelector";

export default function VersionSelector() {
  const {
    versions,
    selectedVersionId,
    isModalOpen,
    isCreateModalOpen,
    newVersionName,
    isLoading,
    modalRef,
    setNewVersionName,
    handleVersionChangeLocal,
    handleCreateNewVersion,
    openVersionModal,
    closeVersionModal,
    openCreateModal,
    closeCreateModal,
    handleBackdropClick,
    getCurrentVersionName,
  } = useVersionSelector();

  return (
    <div className="relative">
      {/* Clickable Version Link */}
      <button
        onClick={openVersionModal}
        disabled={isLoading}
        className="link-style text-sm"
      >
        Version: {getCurrentVersionName()}
      </button>

      {/* Version Selection Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={handleBackdropClick}
        >
          <div 
            ref={modalRef}
            className="bg-white rounded-lg p-6 w-96 max-w-md mx-4 shadow-xl border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Select Version</h3>
            
            {/* Version List */}
            <div className="mb-4 max-h-64 overflow-y-auto">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${
                    version.id === selectedVersionId
                      ? 'bg-blue-50 border-blue-300'
                      : 'hover:bg-gray-50 border-gray-200'
                  }`}
                  onClick={() => {
                    handleVersionChangeLocal(version.id);
                    closeVersionModal();
                  }}
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {version.version_name || `Version ${version.version_number}`}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(version.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Create New Version Button */}
            <div className="flex justify-center">
              <button
                onClick={openCreateModal}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Create New Version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Version Modal */}
      {isCreateModalOpen && (
        <div 
          className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={handleBackdropClick}
        >
          <div 
            ref={modalRef}
            className="bg-white rounded-lg p-6 w-96 max-w-md mx-4 shadow-xl border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Create New Version</h3>
            
            <div className="mb-4">
              <label htmlFor="version-name" className="block text-sm font-medium text-gray-700 mb-2">
                Version Name (optional):
              </label>
              <input
                id="version-name"
                type="text"
                value={newVersionName}
                onChange={(e) => setNewVersionName(e.target.value)}
                placeholder="e.g., Draft 2, Final Review, etc. (leave empty for auto-generated name)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                If left empty, will be named "Version X" automatically
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={closeCreateModal}
                disabled={isLoading}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNewVersion}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Creating..." : "Create Version"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
