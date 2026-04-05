export interface UpgradeUpdate {
  type: 'upgrade_started' | 'step_progress' | 'iteration_started' | 'suggestions_found' | 
        'processing_suggestion' | 'suggestion_applied' | 'suggestion_skipped' | 
        'analysis_complete' | 'upgrade_complete' | 'upgrade_error';
  message: string;
  iteration?: number;
  count?: number;
  suggestion?: {
    claim_number: number;
    type: string;
    severity: string;
    paragraph: number;
    description: string;
    suggestion: string;
  };
  improvement?: {
    claim_number: number;
    description: string;
    original_claim: string;
    improved_claim: string;
  };
  result?: Record<string, unknown>;
  error?: string;
}

export interface UpgradeProgressOverlayProps {
  updates: UpgradeUpdate[];
  isVisible: boolean;
}
