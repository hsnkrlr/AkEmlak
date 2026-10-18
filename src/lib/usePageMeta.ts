import { useEffect } from 'react';

function setMeta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

export function usePageMeta(title: string, description?: string, robots = 'index,follow') {
  useEffect(() => {
    document.title = title;
    if (description) setMeta('description', description);
    setMeta('robots', robots);
  }, [title, description, robots]);
}
