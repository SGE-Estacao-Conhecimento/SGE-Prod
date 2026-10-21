import { useCallback, useEffect, useState } from 'react';

const readSection = (prefix, validSections, fallback) => {
  const match = window.location.hash.match(new RegExp(`^#/${prefix}/([^/?#]+)`));
  const section = match?.[1];
  return validSections.includes(section) ? section : fallback;
};

const useSectionNavigation = (prefix, validSections, fallback) => {
  const [activeSection, setActiveSection] = useState(() => readSection(prefix, validSections, fallback));

  useEffect(() => {
    const syncFromAddress = () => setActiveSection(readSection(prefix, validSections, fallback));
    window.addEventListener('hashchange', syncFromAddress);

    if (!window.location.hash.startsWith(`#/${prefix}/`)) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/${prefix}/${fallback}`);
    }

    return () => window.removeEventListener('hashchange', syncFromAddress);
  }, [fallback, prefix, validSections]);

  const navigate = useCallback((section) => {
    if (!validSections.includes(section)) return;
    setActiveSection(section);
    const nextHash = `#/${prefix}/${section}`;
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
  }, [prefix, validSections]);

  return [activeSection, navigate];
};

export default useSectionNavigation;
