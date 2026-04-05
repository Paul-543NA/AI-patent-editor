import { useEffect, useState } from "react";
import { UpgradeUpdate, UpgradeProgressOverlayProps } from "./types";
import {
  Overlay,
  SpinnerContainer,
  Spinner,
  ProgressMessage,
  ProgressSubMessage,
  CardsContainer,
  Card
} from "./styles";

export default function UpgradeProgressOverlay({ updates, isVisible }: UpgradeProgressOverlayProps) {
  const [displayedCards, setDisplayedCards] = useState<UpgradeUpdate[]>([]);
  const [newCardIds, setNewCardIds] = useState<Set<number>>(new Set());
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    // Filter updates that should be displayed as cards
    const cardUpdates = updates.filter(update => 
      update.type === 'processing_suggestion' || 
      update.type === 'suggestion_applied' || 
      update.type === 'suggestion_skipped'
    );
    
    // Add new cards with animation
    if (cardUpdates.length > displayedCards.length) {
      setIsTransitioning(true);
      const newCards = cardUpdates.slice(displayedCards.length);
      const newCardIndexes = new Set<number>();
      
      // Mark new cards for animation (they will be at the beginning after reverse)
      newCards.forEach((_, index) => {
        newCardIndexes.add(index);
      });
      
      setNewCardIds(newCardIndexes);
      
      // Small delay to allow existing cards to start their transition
      setTimeout(() => {
        setDisplayedCards(cardUpdates);
      }, 50);
      
      // Remove the 'new' state and transition state after animation
      setTimeout(() => {
        setNewCardIds(new Set());
        setIsTransitioning(false);
      }, 1000);
    }
  }, [updates, displayedCards.length]);

  const getLatestProgressMessage = () => {
    const progressUpdates = updates.filter(u => u.message && (
      u.type === 'upgrade_started' ||
      u.type === 'step_progress' ||
      u.type === 'iteration_started' ||
      u.type === 'suggestions_found' ||
      u.type === 'analysis_complete'
    ));
    return progressUpdates[progressUpdates.length - 1]?.message || 'Processing...';
  };

  const getProgressSubMessage = () => {
    const appliedCount = displayedCards.filter(u => u.type === 'suggestion_applied').length;
    const processedCount = displayedCards.filter(u => u.type === 'processing_suggestion').length;
    
    if (processedCount > 0) {
      return `${appliedCount} improvements applied, ${processedCount - appliedCount} analyzed`;
    }
    return '';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  if (!isVisible) return null;

  return (
    <Overlay>
      <SpinnerContainer>
        <Spinner />
        <ProgressMessage>{getLatestProgressMessage()}</ProgressMessage>
        <ProgressSubMessage>{getProgressSubMessage()}</ProgressSubMessage>
      </SpinnerContainer>
      
      <CardsContainer>
        {displayedCards.slice().reverse().map((update, reverseIndex) => {
          const originalIndex = displayedCards.length - 1 - reverseIndex;
          const isNew = newCardIds.has(reverseIndex);
          const animationDelay = isNew ? reverseIndex * 100 : 0;
          
          if (update.type === 'processing_suggestion' && update.suggestion) {
            return (
              <Card key={originalIndex} $isNew={isNew} $animationDelay={animationDelay} $isTransitioning={isTransitioning}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <div 
                    style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      backgroundColor: getSeverityColor(update.suggestion.severity),
                      marginRight: '8px' 
                    }}
                  />
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    Claim {update.suggestion.claim_number}: {update.suggestion.type}
                  </h3>
                </div>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#6b7280' }}>
                  {update.suggestion.description}
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: '#4b5563' }}>
                  <strong>Suggestion:</strong> {update.suggestion.suggestion}
                </p>
              </Card>
            );
          } else if (update.type === 'suggestion_applied' && update.improvement) {
            return (
              <Card key={originalIndex} $isNew={isNew} $animationDelay={animationDelay} $isTransitioning={isTransitioning}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <div 
                    style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      backgroundColor: '#10b981',
                      marginRight: '8px' 
                    }}
                  />
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#059669' }}>
                    ✓ Applied: Claim {update.improvement.claim_number} Improved
                  </h3>
                </div>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#6b7280' }}>
                  {update.improvement.description}
                </p>
                <div style={{ fontSize: '12px' }}>
                  <p style={{ margin: '0 0 4px 0', color: '#6b7280' }}>
                    <strong>Before:</strong> {update.improvement.original_claim.substring(0, 100)}...
                  </p>
                  <p style={{ margin: 0, color: '#059669' }}>
                    <strong>After:</strong> {update.improvement.improved_claim.substring(0, 100)}...
                  </p>
                </div>
              </Card>
            );
          } else if (update.type === 'suggestion_skipped' && update.suggestion) {
            return (
              <Card key={originalIndex} $isNew={isNew} $animationDelay={animationDelay} $isTransitioning={isTransitioning}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <div 
                    style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      backgroundColor: '#9ca3af',
                      marginRight: '8px' 
                    }}
                  />
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#6b7280' }}>
                    ⊝ Skipped: Claim {update.suggestion.claim_number}
                  </h3>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                  {update.suggestion.description} - No improvement needed
                </p>
              </Card>
            );
          }
          return null;
        })}
      </CardsContainer>
    </Overlay>
  );
}
