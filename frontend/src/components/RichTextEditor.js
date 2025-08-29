import React, { useState, useRef } from 'react';
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  Quote,
  Link,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';

const RichTextEditor = ({ value, onChange, placeholder = "Inhalt eingeben...", height = "300px" }) => {
  const [isPreview, setIsPreview] = useState(false);
  const textareaRef = useRef(null);

  const insertText = (before, after = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
    onChange(newText);

    // Focus and set cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

  const insertHeading = (level) => {
    const prefix = '#'.repeat(level) + ' ';
    insertText(prefix);
  };

  const insertList = (ordered = false) => {
    const prefix = ordered ? '1. ' : '- ';
    insertText('\n' + prefix);
  };

  const insertLink = () => {
    const url = prompt('Link-URL eingeben:');
    if (url) {
      insertText('[Linktext](', `${url})`);
    }
  };

  const formatMarkdown = (text) => {
    if (!text) return '';
    
    return text
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      // Lists
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/^1\. (.*$)/gim, '<li>$1</li>')
      // Line breaks
      .replace(/\n/g, '<br>');
  };

  return (
    <div className="rich-text-editor border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="bg-gray-50 border-b p-2 flex flex-wrap gap-1">
        <div className="flex gap-1 mr-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertHeading(1)}
            title="Überschrift 1"
          >
            <Type className="w-4 h-4" />
            <span className="text-xs ml-1">H1</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertHeading(2)}
            title="Überschrift 2"
          >
            <Type className="w-4 h-4" />
            <span className="text-xs ml-1">H2</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertHeading(3)}
            title="Überschrift 3"
          >
            <Type className="w-4 h-4" />
            <span className="text-xs ml-1">H3</span>
          </Button>
        </div>

        <div className="flex gap-1 mr-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertText('**', '**')}
            title="Fett"
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertText('*', '*')}
            title="Kursiv"
          >
            <Italic className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex gap-1 mr-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertList(false)}
            title="Aufzählung"
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertList(true)}
            title="Nummerierte Liste"
          >
            <ListOrdered className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex gap-1 mr-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertText('> ')}
            title="Zitat"
          >
            <Quote className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={insertLink}
            title="Link"
          >
            <Link className="w-4 h-4" />
          </Button>
        </div>

        <div className="ml-auto">
          <Button
            type="button"
            variant={isPreview ? "default" : "ghost"}
            size="sm"
            onClick={() => setIsPreview(!isPreview)}
          >
            {isPreview ? 'Bearbeiten' : 'Vorschau'}
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div style={{ height }}>
        {isPreview ? (
          <div 
            className="p-4 h-full overflow-y-auto prose prose-emerald max-w-none"
            dangerouslySetInnerHTML={{ 
              __html: formatMarkdown(value) || '<p class="text-gray-400 italic">Keine Inhalte vorhanden...</p>' 
            }}
          />
        ) : (
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`${placeholder}

Formatierungshilfe:
# Überschrift 1
## Überschrift 2  
### Überschrift 3
**Fetter Text**
*Kursiver Text*
- Aufzählung
1. Nummerierte Liste
> Zitat
[Linktext](URL)`}
            className="w-full h-full border-0 resize-none focus:ring-0 font-mono text-sm"
            style={{ minHeight: height }}
          />
        )}
      </div>

      {/* Help Text */}
      <div className="bg-gray-50 border-t px-4 py-2 text-xs text-gray-600">
        <strong>Markdown-Formatierung:</strong> **fett**, *kursiv*, # Überschrift, - Liste, [Link](URL)
      </div>
    </div>
  );
};

export default RichTextEditor;