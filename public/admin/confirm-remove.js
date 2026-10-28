// Asks for confirmation before a list item (sponsor, stage, edition, text block, …)
// is removed in Sveltia CMS, which otherwise removes it on a single click.
// Matches Sveltia's own remove button: an icon button labelled "Remove" with the
// "close" icon (checked against v0.253.2; recheck after a CMS update).
// Runs in the capture phase, before Sveltia's click handler, so Cancel stops it.
window.addEventListener(
  'click',
  (event) => {
    const button = event.target instanceof Element ? event.target.closest('button[aria-label="Remove"]') : null;
    if (!button || button.disabled || button.querySelector('.material-symbols-outlined')?.textContent?.trim() !== 'close') return;
    if (window.confirm('Remove this item?\n\nIt is only gone for good after you save.')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  },
  true,
);
