import { SuggestionData } from '../contexts/AppContext';

interface SuggestionCardProps {
  data: SuggestionData;
  onClose: () => void;
}

export default function SuggestionCard({ data, onClose }: SuggestionCardProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'border-red-500 bg-red-50';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50';
      case 'low':
        return 'border-green-500 bg-green-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  const getSeverityTextColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'text-red-700';
      case 'medium':
        return 'text-yellow-700';
      case 'low':
        return 'text-green-700';
      default:
        return 'text-gray-700';
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`relative border-l-4 rounded-lg shadow-sm p-4 mb-3 transition-all duration-200 hover:shadow-md ${getSeverityColor(data.severity)}`}>
      {/* Close button */}
      <button
        onClick={onClose}
        className="close-button absolute top-2 right-2 text-gray-500 hover:text-gray-700"
        aria-label="Close suggestion"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-3 pr-8">
        <div>
          <h3 className={`font-semibold text-sm leading-tight ${getSeverityTextColor(data.severity)}`}>
            {data.type}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSeverityBadgeColor(data.severity)}`}>
              {data.severity.toUpperCase()}
            </span>
            <span className="text-xs text-gray-500">
              Paragraph {data.paragraph}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="mb-3">
        <p className="text-sm text-gray-700 leading-relaxed">
          {data.description}
        </p>
      </div>

      {/* Suggestion */}
      <div className="border-t border-gray-200 pt-3">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          Suggestion
        </h4>
        <p className="text-sm text-gray-800 leading-relaxed">
          {data.suggestion}
        </p>
      </div>
    </div>
  );
}