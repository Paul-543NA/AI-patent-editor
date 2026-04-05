import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import useWebSocket from "react-use-websocket";
import { debounce } from "lodash";
import { useCallback, useRef } from "react";
import { DocumentVersion } from '../internal/VersionSelector/useVersionSelector';
import { UpgradeUpdate } from '../internal/UpgradeProgressOverlay/types';
import {
  SuggestionData,
  parseStreamingJSON,
} from '../utils/parseSuggestions';

export type { SuggestionData };

const BACKEND_URL = "http://localhost:8000";
const SOCKET_URL = "ws://localhost:8000/ws";

interface AppContextType {
  // State
  currentDocumentContent: string;
  currentDocumentId: number;
  isLoading: boolean;
  currentVersionId: number | undefined;
  suggestions: SuggestionData[];
  websocketResponse: string;
  isReceivingAiSuggestions: boolean;
  upgradeUpdates: UpgradeUpdate[];
  isUpgrading: boolean;
  
  // Actions
  loadPatent: (documentNumber: number) => Promise<void>;
  savePatent: (documentNumber: number) => Promise<void>;
  upgradeDocumentAutomatically: () => Promise<void>;
  handleVersionChange: (version: DocumentVersion) => void;
  handleNewVersion: (content: string) => void;
  setCurrentDocumentContent: (content: string) => void;
  removeSuggestion: (index: number) => void;
  clearSuggestions: () => void;
  registerVersionRefreshCallback: (callback: () => Promise<void>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppContextProviderProps {
  children: ReactNode;
}

export function AppContextProvider({ children }: AppContextProviderProps) {
  const [currentDocumentContent, setCurrentDocumentContent] = useState<string>("");
  const [currentDocumentId, setCurrentDocumentId] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentVersionId, setCurrentVersionId] = useState<number | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<SuggestionData[]>([]);
  const [websocketResponse, setWebsocketResponse] = useState<string>("");
  const [isReceivingAiSuggestions, setIsReceivingAiSuggestions] = useState<boolean>(false);
  const [upgradeUpdates, setUpgradeUpdates] = useState<UpgradeUpdate[]>([]);
  const [isUpgrading, setIsUpgrading] = useState<boolean>(false);
  const [upgradeSessionId, setUpgradeSessionId] = useState<string>("");
  
  // Callback to refresh versions - will be set by VersionSelector
  const versionRefreshCallbackRef = useRef<(() => Promise<void>) | null>(null);

  // WebSocket setup for regular suggestions
  const { sendMessage, lastMessage, readyState } = useWebSocket(SOCKET_URL, {
    onOpen: () => console.log("WebSocket Connected"),
    onClose: () => console.log("WebSocket Disconnected"),
    shouldReconnect: () => true,
  });

  // WebSocket setup for upgrade progress
  const upgradeWebSocketUrl = upgradeSessionId 
    ? `ws://localhost:8000/ws/upgrade/${currentDocumentId}/${upgradeSessionId}`
    : null;
  
  const { lastMessage: upgradeMessage } = useWebSocket(
    upgradeWebSocketUrl, 
    {
      onOpen: () => console.log("Upgrade WebSocket Connected"),
      onClose: () => console.log("Upgrade WebSocket Disconnected"),
      shouldReconnect: () => false, // Don't auto-reconnect upgrade websockets
    },
    upgradeSessionId !== ""  // Only connect when we have a session ID
  );

  // Create refs for stable references in debounced function
  const sendMessageRef = useRef(sendMessage);
  const readyStateRef = useRef(readyState);

  // Update refs when values change
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  useEffect(() => {
    readyStateRef.current = readyState;
  }, [readyState]);


  // Handle websocket messages
  useEffect(() => {
    if (lastMessage !== null) {      
      // Set indicator that we're receiving AI suggestions
      setIsReceivingAiSuggestions(true);
      
       // Append the new message to the accumulated response
      setWebsocketResponse((prev: string) => {
        const newResponse = prev + lastMessage.data;
        
        // Check if we've received the completion signal
        if (newResponse.includes("--- Done sending suggestions ---")) {
          // Stop the indicator
          setIsReceivingAiSuggestions(false);
          
          // Parse the complete response for JSON objects
          const newSuggestions = parseStreamingJSON(newResponse);
          if (newSuggestions.length > 0) {
            setSuggestions(newSuggestions);
          }
        }
        
        return newResponse;
      });
    }
  }, [lastMessage]);

  // Handle upgrade progress messages
  useEffect(() => {
    if (upgradeMessage !== null) {
      try {
        const update: UpgradeUpdate = JSON.parse(upgradeMessage.data);
        setUpgradeUpdates(prev => [...prev, update]);

        // Handle completion or error
        if (update.type === 'upgrade_complete' || update.type === 'upgrade_error') {
          setIsUpgrading(false);
          setUpgradeSessionId(""); // Clear session ID to disconnect WebSocket
        }
      } catch (error) {
        console.error("Failed to parse upgrade message:", error);
      }
    }
  }, [upgradeMessage]);

  // Create a stable debounced function using useRef
  const debouncedSendMessage = useRef(
    debounce((content: string) => {
      if (readyStateRef.current === 1) { // WebSocket.OPEN
        // Clear previous suggestions and response when sending new content
        setSuggestions([]);
        setWebsocketResponse("");
        setIsReceivingAiSuggestions(false);
        sendMessageRef.current(content);
      } else {
        console.log("WebSocket not ready, readyState:", readyStateRef.current);
      }
    }, 500)
  ).current;

  // Load the first patent on mount
  useEffect(() => {
    loadPatent(1);
  }, []);

  // Callback to load a patent from the backend
  const loadPatent = async (documentNumber: number) => {
    setIsLoading(true);
    try {
      const response = await axios.get(
        `${BACKEND_URL}/document/${documentNumber}`
      );
      setCurrentDocumentContent(response.data.content);
      setCurrentDocumentId(documentNumber);
      setCurrentVersionId(response.data.current_version_id);
    } catch (error) {
      console.error("Error loading document:", error);
    }
    setIsLoading(false);
  };

  // Callback to persist a patent in the DB
  const savePatent = async (documentNumber: number) => {
    setIsLoading(true);
    try {
      await axios.post(`${BACKEND_URL}/save/${documentNumber}/version/${currentVersionId}`, {
        content: currentDocumentContent,
      });
    } catch (error) {
      console.error("Error saving document:", error);
    }
    setIsLoading(false);
  };

  // Handle version change
  const handleVersionChange = (version: DocumentVersion) => {
    setCurrentDocumentContent(version.content);
    setCurrentVersionId(version.id);
  };

  // Handle new version creation
  const handleNewVersion = (content: string) => {
    setCurrentDocumentContent(content);
  };

  // Enhanced setCurrentDocumentContent that triggers websocket
  const setCurrentDocumentContentWithWebsocket = useCallback((content: string) => {
    setCurrentDocumentContent(content);
    debouncedSendMessage(content);
  }, [debouncedSendMessage]);

  // Function to remove a suggestion
  const removeSuggestion = useCallback((index: number) => {
    setSuggestions(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Function to clear all suggestions
  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setWebsocketResponse("");
    setIsReceivingAiSuggestions(false);
  }, []);

  // Function to register version refresh callback
  const registerVersionRefreshCallback = useCallback((callback: () => Promise<void>) => {
    versionRefreshCallbackRef.current = callback;
  }, []);

  // Function to upgrade document automatically with WebSocket progress
  const upgradeDocumentAutomatically = useCallback(async () => {
    // Generate unique session ID for this upgrade
    const sessionId = `upgrade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Clear previous upgrade updates and start the process
    setUpgradeUpdates([]);
    setIsUpgrading(true);
    setUpgradeSessionId(sessionId);
    
    try {
      // Wait a moment for WebSocket to connect
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Upgrade the document automatically with WebSocket support
      const response = await axios.post(`${BACKEND_URL}/document/${currentDocumentId}/upgrade`, {}, {
        params: { session_id: sessionId }
      });
      
      const result = response.data;      
      if (result.success) {
        // Update the document content with the improved version
        setCurrentDocumentContent(result.improved_document);
        
        // Update the current version ID if a new version was created
        if (result.new_version_id) {
          setCurrentVersionId(result.new_version_id);
          
          // Refresh the version list to show the new version
          if (versionRefreshCallbackRef.current) {
            try {
              await versionRefreshCallbackRef.current();
            } catch (error) {
              console.error("Error refreshing version list:", error);
            }
          }
        }
        
        // Clear existing suggestions since we've applied improvements
        clearSuggestions();
        
        // Alert user of successful upgrade (only if not using visual feedback)
        if (result.total_improvements > 0) {
          setTimeout(() => {
            alert(`✅ Document upgraded successfully!\n\nApplied ${result.total_improvements} improvements in ${result.iterations_completed} iterations.\n\nA new version has been created.`);
          }, 1000);
        } else {
          setTimeout(() => {
            alert(`✅ Document analyzed successfully!\n\nNo improvements were needed - your document is already well-written.`);
          }, 1000);
        }
        
        // Optionally, trigger new suggestions for the improved document
        setTimeout(() => {
          debouncedSendMessage(result.improved_document);
        }, 2000);
        
      } else {
        console.error("Document upgrade failed:", result.error);
        setIsUpgrading(false);
        setUpgradeSessionId("");
        alert(`❌ Document upgrade failed!\n\nError: ${result.error || 'Unknown error occurred'}\n\nPlease try again or check your document content.`);
      }
      
    } catch (error) {
      console.error("Error upgrading document:", error);
      setIsUpgrading(false);
      setUpgradeSessionId("");
      const errorMessage = error instanceof Error ? error.message : 'Unknown network error';
      alert(`❌ Network error during document upgrade!\n\nPlease check your connection and try again.\n\nError: ${errorMessage}`);
    }
  }, [currentDocumentId, clearSuggestions, debouncedSendMessage]);

  const value: AppContextType = {
    currentDocumentContent,
    currentDocumentId,
    isLoading,
    currentVersionId,
    suggestions,
    websocketResponse,
    isReceivingAiSuggestions,
    upgradeUpdates,
    isUpgrading,
    loadPatent,
    savePatent,
    upgradeDocumentAutomatically,
    handleVersionChange,
    handleNewVersion,
    setCurrentDocumentContent: setCurrentDocumentContentWithWebsocket,
    removeSuggestion,
    clearSuggestions,
    registerVersionRefreshCallback,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
}
