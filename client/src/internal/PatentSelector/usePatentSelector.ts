import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAppContext } from '../../contexts/AppContext';

const BACKEND_URL = "http://localhost:8000";

export interface Patent {
  id: number;
  name: string;
  title: string;
}

interface DocumentSummary {
  id: number;
  title: string | null;
}

async function fetchDocuments(): Promise<Patent[]> {
  const response = await axios.get<DocumentSummary[]>(`${BACKEND_URL}/documents`);
  return response.data.map(doc => ({
    id: doc.id,
    name: `Patent ${doc.id}`,
    title: doc.title ?? `Patent ${doc.id}`,
  }));
}

export function usePatentSelector() {
  const { currentDocumentId, loadPatent, isLoading, clearSuggestions } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const { data: patents = [] } = useQuery<Patent[]>({
    queryKey: ['documents'],
    queryFn: fetchDocuments,
  });

  // Patent selection handlers
  const handlePatentChangeLocal = async (patentId: number) => {
    if (patentId !== currentDocumentId && !isLoading) {
      clearSuggestions();
      await loadPatent(patentId);
    }
  };

  // Modal handlers
  const openPatentModal = () => {
    if (!isLoading) {
      setIsModalOpen(true);
    }
  };

  const closePatentModal = () => {
    setIsModalOpen(false);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      closePatentModal();
    }
  };

  // Get current patent info
  const getCurrentPatent = (): Patent | undefined => {
    return patents.find(patent => patent.id === currentDocumentId);
  };

  const getCurrentPatentName = (): string => {
    const currentPatent = getCurrentPatent();
    return currentPatent?.name || `Patent ${currentDocumentId}`;
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isModalOpen) {
        closePatentModal();
      }
    };

    if (isModalOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [isModalOpen]);

  return {
    patents,
    selectedPatentId: currentDocumentId,
    isModalOpen,
    isLoading,
    modalRef,
    handlePatentChangeLocal,
    openPatentModal,
    closePatentModal,
    handleBackdropClick,
    getCurrentPatent,
    getCurrentPatentName,
  };
}
