import React, { useState } from "react";
import { AlertCircle, Check, Copy, ExternalLink, Loader } from "lucide-react";

export const Spinner = () => (
  <div className="flex justify-center items-center p-8">
    <Loader className="animate-spin text-blue-500" size={48} />
  </div>
);

export const ErrorMessage = ({ children }: { children: React.ReactNode }) => (
  <div
    className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4"
    role="alert"
  >
    <div className="flex">
      <div className="py-1">
        <AlertCircle className="h-6 w-6 text-red-500 mr-4" />
      </div>
      <div>
        <p className="font-bold">Error</p>
        <p>{children}</p>
      </div>
    </div>
  </div>
);

export const CopyButton = ({ textToCopy }: { textToCopy: string }) => {
  const [copied, setCopied] = useState(false);
  const cleanedText = textToCopy.replace(/【.*?】/g, "").trim();

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cleanedText) return;

    navigator.clipboard.writeText(cleanedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      onClick={handleCopy}
      title={`Copy "${cleanedText}"`}
      className="text-gray-400 hover:text-blue-600 transition-colors relative"
    >
      {copied ? (
        <Check size={16} className="text-green-500" />
      ) : (
        <Copy size={16} />
      )}
    </button>
  );
};

export const SuiSiannLink = ({ text }: { text: string }) => {
  const cleanedText = text.replace(/【.*?】/g, "").trim();
  if (!cleanedText) return null;

  const url = `http://suisiann.ithuan.tw/%E8%AC%9B/${encodeURIComponent(cleanedText)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="在「鬥拍字」中查看/朗讀"
      className="text-gray-400 hover:text-red-500 transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      <ExternalLink size={16} />
    </a>
  );
};

export const CopyableText = ({
  text,
  className,
}: {
  text: string;
  className?: string;
}) => (
  <div
    className={`group inline-flex items-center gap-2 ${className ?? ""}`.trim()}
  >
    <span>{text}</span>
    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
      <CopyButton textToCopy={text} />
      <SuiSiannLink text={text} />
    </div>
  </div>
);

export const DetailSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  if (!children || (Array.isArray(children) && children.length === 0))
    return null;

  return (
    <div className="flex items-start mt-2">
      <strong className="font-semibold text-gray-600 w-24 flex-shrink-0">
        {title}:
      </strong>
      <div className="flex-grow flex flex-wrap gap-x-4 gap-y-1">{children}</div>
    </div>
  );
};

export const StyledRadio = ({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <label className="flex items-center space-x-2 cursor-pointer text-gray-700">
    <input type="radio" className="sr-only peer" {...props} />
    <span className="w-5 h-5 rounded-full border-2 border-gray-300 bg-white peer-checked:border-blue-600 flex items-center justify-center transition">
      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 scale-0 peer-checked:scale-100 transition-transform duration-150"></span>
    </span>
    <span>{label}</span>
  </label>
);

export const StyledCheckbox = ({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <label className="flex items-center space-x-2 cursor-pointer text-sm text-gray-700">
    <input type="checkbox" className="sr-only peer" {...props} />
    <span className="w-4 h-4 rounded border-2 border-gray-300 bg-white peer-checked:bg-blue-600 peer-checked:border-blue-600 flex items-center justify-center transition-colors">
      <Check
        size={12}
        className="text-white scale-0 peer-checked:scale-100 transition-transform duration-150"
        strokeWidth={3}
      />
    </span>
    <span>{label}</span>
  </label>
);
