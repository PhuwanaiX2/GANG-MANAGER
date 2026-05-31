(() => {
  try {
    const themeKey = 'gang-manager-theme';
    const accentKey = 'gang-manager-accent';
    const savedTheme = localStorage.getItem(themeKey);
    const savedAccent = localStorage.getItem(accentKey);
    const theme =
      savedTheme === 'light' || savedTheme === 'dark'
        ? savedTheme
        : matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark';
    const accent = ['ember', 'cobalt', 'jade', 'gold'].includes(savedAccent)
      ? savedAccent
      : 'ember';
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.accent = accent;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    root.style.colorScheme = theme;
  } catch {
    const root = document.documentElement;
    root.dataset.theme = 'dark';
    root.dataset.accent = 'ember';
    root.classList.add('dark');
  }
})();
