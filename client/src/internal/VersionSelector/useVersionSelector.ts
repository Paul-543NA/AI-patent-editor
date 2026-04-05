import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useAppContext } from "../../contexts/AppContext";

const BACKEND_URL = "http://localhost:8000";

export interface DocumentVersion {
  id: number;
  document_id: number;
  content: string;
  version_number: number;
  version_name?: string;
  created_at: string;
  updated_at: string;
}

export function useVersionSelector() {
  const { currentDocumentId, currentVersionId, handleVersionChange, handleNewVersion, clearSuggestions, registerVersionRefreshCallback } = useAppContext();
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | undefined>(currentVersionId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newVersionName, setNewVersionName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const loadVersions = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/document/${currentDocumentId}/versions`);
      setVersions(response.data);
    } catch (error) {
      console.error("Error loading versions:", error);
    }
  }, [currentDocumentId]);

  // Load versions when document changes
  useEffect(() => {
    if (currentDocumentId) {
      loadVersions();
    }
  }, [currentDocumentId, loadVersions]);

  // Register loadVersions callback with AppContext
  useEffect(() => {
    registerVersionRefreshCallback(loadVersions);
  }, [registerVersionRefreshCallback, loadVersions]);

  // Update selected version when currentVersionId changes
  useEffect(() => {
    setSelectedVersionId(currentVersionId);
  }, [currentVersionId]);

  // Handle ESC key to close modals
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isModalOpen) {
          closeVersionModal();
        } else if (isCreateModalOpen) {
          closeCreateModal();
        }
      }
    };

    if (isModalOpen || isCreateModalOpen) {
      document.addEventListener('keydown', handleEscKey);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen, isCreateModalOpen]);

  const handleVersionChangeLocal = async (versionId: number) => {
    if (versionId === selectedVersionId) return;

    setIsLoading(true);
    clearSuggestions(); // Clear suggestions when switching versions
    try {
      const response = await axios.get(`${BACKEND_URL}/document/${currentDocumentId}/version/${versionId}`);
      setSelectedVersionId(versionId);
      handleVersionChange(response.data);
    } catch (error) {
      console.error("Error loading version:", error);
    }
    setIsLoading(false);
  };

  const handleCreateNewVersion = async () => {
    if (!newVersionName.trim()) return;

    setIsLoading(true);
    clearSuggestions(); // Clear suggestions when creating new version
    try {
      // Get current document content to create new version
      const currentDocResponse = await axios.get(`${BACKEND_URL}/document/${currentDocumentId}`);
      const currentContent = currentDocResponse.data.content;

      const response = await axios.post(`${BACKEND_URL}/document/${currentDocumentId}/version`, {
        content: currentContent,
        version_name: newVersionName.trim() || undefined,
      });

      // Reload versions and select the new one
      await loadVersions();
      setSelectedVersionId(response.data.id);
      handleNewVersion(response.data.content);
      setIsCreateModalOpen(false);
      setNewVersionName("");
    } catch (error) {
      console.error("Error creating new version:", error);
    }
    setIsLoading(false);
  };

  const openVersionModal = () => {
    setIsModalOpen(true);
  };

  const closeVersionModal = () => {
    setIsModalOpen(false);
  };

  const openCreateModal = () => {
    setIsCreateModalOpen(true);
    setNewVersionName("");
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setNewVersionName("");
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      if (isModalOpen) {
        closeVersionModal();
      } else if (isCreateModalOpen) {
        closeCreateModal();
      }
    }
  };

  const getCurrentVersionName = () => {
    const currentVersion = versions.find(v => v.id === selectedVersionId);
    return currentVersion ? (currentVersion.version_name || `Version ${currentVersion.version_number}`) : "Select Version";
  };

  return {
    // State
    versions,
    selectedVersionId,
    isModalOpen,
    isCreateModalOpen,
    newVersionName,
    isLoading,
    modalRef,
    
    // Actions
    setNewVersionName,
    handleVersionChangeLocal,
    handleCreateNewVersion,
    openVersionModal,
    closeVersionModal,
    openCreateModal,
    closeCreateModal,
    handleBackdropClick,
    getCurrentVersionName,
  };
}
