/** One stroke language for the observatory controls; decorative, named by the control. */
const paths={
 clear:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
 sunset:'<path d="M3 14a9 9 0 0 1 18 0M2 14h20M4 18h16M8 21h8"/>',
 rain:'<path d="m9 3-6 8M19 3 5 21m16-10-7 10"/>',
 storm:'<path d="m14 2-9 12h7l-2 8 9-12h-7Z"/>',
 sliders:'<path d="M3 6h8m4 0h6M3 12h2m4 0h12M3 18h12m4 0h2"/><circle cx="13" cy="6" r="2"/><circle cx="7" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
 pause:'<path d="M8 5v14M16 5v14" stroke-width="3"/>',
 play:'<path d="m8 4 12 8-12 8Z"/>',
 plus:'<path d="M12 4v16M4 12h16"/>',
 minus:'<path d="M4 12h16"/>',
 frame:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
} as const;
export function icon(name:keyof typeof paths){return `<svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`;}
