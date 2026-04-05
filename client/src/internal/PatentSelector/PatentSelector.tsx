import { usePatentSelector } from "./usePatentSelector";

export default function PatentSelector() {
  const {
    patents,
    selectedPatentId,
    isModalOpen,
    isLoading,
    modalRef,
    handlePatentChangeLocal,
    openPatentModal,
    closePatentModal,
    handleBackdropClick,
    getCurrentPatentName,
  } = usePatentSelector();

  return (
    <div className="relative">
      {/* Clickable Patent Name */}
      <button
        onClick={openPatentModal}
        disabled={isLoading}
        className="header-style"
      >
        {getCurrentPatentName()}
      </button>

      {/* Patent Selection Modal */}
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
            <h3 className="text-lg font-semibold mb-4">Select Patent</h3>
            
            {/* Patent List */}
            <div className="mb-4 max-h-64 overflow-y-auto">
              {patents.map((patent) => (
                <div
                  key={patent.id}
                  className={`flex flex-col p-3 rounded-md border cursor-pointer transition-colors mb-2 ${
                    patent.id === selectedPatentId
                      ? 'bg-blue-50 border-blue-300'
                      : 'hover:bg-gray-50 border-gray-200'
                  }`}
                  onClick={() => {
                    handlePatentChangeLocal(patent.id);
                    closePatentModal();
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-900">
                      {patent.name}
                    </div>
                    {patent.id === selectedPatentId && (
                      <div className="text-blue-600 text-sm">
                        ✓ Current
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {patent.title}
                  </div>
                </div>
              ))}
            </div>

            {/* Close Button */}
            <div className="flex justify-end">
              <button
                onClick={closePatentModal}
                disabled={isLoading}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
