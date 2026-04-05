import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";

export const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

export const slideInFadeIn = keyframes`
  from {
    transform: translateY(-20px);
    opacity: 0;
    scale: 0.95;
  }
  to {
    transform: translateY(0);
    opacity: 1;
    scale: 1;
  }
`;

export const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.95);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  padding: 20px;
  overflow-y: auto;
`;

export const SpinnerContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 50px 0 30px 0;
`;

export const Spinner = styled.div`
  border: 4px solid rgba(0, 0, 0, 0.1);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border-left-color: #09f;
  animation: ${spin} 1s linear infinite;
  margin-bottom: 16px;
`;

export const ProgressMessage = styled.div`
  color: #333;
  font-size: 16px;
  font-weight: 500;
  text-align: center;
  margin-bottom: 8px;
`;

export const ProgressSubMessage = styled.div`
  color: #666;
  font-size: 14px;
  text-align: center;
`;

export const CardsContainer = styled.div`
  width: 100%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* Provide a stable container for smooth transitions */
  transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
`;

export const Card = styled.div<{ $isNew?: boolean; $animationDelay?: number; $isTransitioning?: boolean }>`
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  transform: ${props => props.$isNew ? 'translateY(-20px) scale(0.95)' : 'translateY(0) scale(1)'};
  opacity: ${props => props.$isNew ? 0 : 1};
  animation: ${props => props.$isNew ? `${slideInFadeIn} 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards` : 'none'};
  animation-delay: ${props => props.$animationDelay ? `${props.$animationDelay}ms` : '0ms'};
  
  /* Ensure smooth repositioning when layout changes */
  position: relative;
  z-index: 1;
  
  /* Enhanced transition when cards are repositioning */
  ${props => props.$isTransitioning && !props.$isNew && `
    transform: translateY(0) scale(1);
    transition-duration: 0.6s;
    transition-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  `}
  
  &:hover {
    transform: translateY(-2px) scale(1.01);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
    z-index: 2;
    transition-duration: 0.2s;
  }
`;
