import React from 'react';
import { FileCode2, FileJson, FileType2, ChevronRight, Folder } from 'lucide-react';

function iconFor(path) {
  if (path.endsWith('.css')) return <FileType2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />;
  if (path.endsWith('.json')) return <FileJson className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
  return <FileCode2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />;
}

function buildTree(files) {
  const root = { name: '', children: {}, files: [] };
  for (const path of Object.keys(files).sort()) {
    const parts = path.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      if (!node.children[seg]) node.children[seg] = { name: seg, children: {}, files: [], depth: i };
      node = node.children[seg];
    }
    node.files.push({ name: parts[parts.length - 1], path, depth: parts.length - 1 });
  }
  return root;
}

function TreeNode({ node, activeFile, onSelect, depth }) {
  const dirs = Object.values(node.children).sort((a, b) => a.name.localeCompare(b.name));
  const files = [...node.files].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div>
      {dirs.map((d) => (
        <div key={d.name}>
          <div className="flex items-center gap-1 py-1 px-2 text-xs text-muted-foreground select-none" style={{ paddingLeft: depth * 12 + 8 }}>
            <ChevronRight className="w-3 h-3" />
            <Folder className="w-3.5 h-3.5 text-muted-foreground/70" />
            <span className="font-medium">{d.name}</span>
          </div>
          <TreeNode node={d} activeFile={activeFile} onSelect={onSelect} depth={depth + 1} />
        </div>
      ))}
      {files.map((f) => (
        <button
          key={f.path}
          onClick={() => onSelect(f.path)}
          className={`w-full flex items-center gap-1.5 py-1 pr-2 text-xs font-mono text-right transition-colors ${
            activeFile === f.path ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'
          }`}
          style={{ paddingLeft: depth * 12 + 10 }}
        >
          {iconFor(f.path)}
          <span className="truncate">{f.name}</span>
        </button>
      ))}
    </div>
  );
}

export default function FileTree({ files, activeFile, onSelect }) {
  const tree = buildTree(files);
  if (!Object.keys(files).length) {
    return <div className="p-3 text-xs text-muted-foreground text-center">لا توجد ملفات بعد</div>;
  }
  return (
    <div className="py-1 select-none">
      <TreeNode node={tree} activeFile={activeFile} onSelect={onSelect} depth={0} />
    </div>
  );
}