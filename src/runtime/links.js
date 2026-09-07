/** Browser effects for the navigator, wired in main.js. */
export const browserLinks = {
  newTab(url) {
    // A synthetic anchor opens a regular tab; window.open with features can
    // produce a stripped popup. Keep the opener isolated in either case.
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
  mailto(url) {
    window.location.href = url;
  },
};
