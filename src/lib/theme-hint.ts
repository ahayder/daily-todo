/** localStorage key holding the last applied theme ("dark" | "light") for the pre-hydration script. */
export const THEME_HINT_STORAGE_KEY = "dailytodo-theme-hint";

/**
 * Inline script run before hydration: applies the last theme so the first paint matches.
 * Defaults to dark (the primary theme) when nothing is stored.
 */
export const THEME_HINT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_HINT_STORAGE_KEY}");var d=t!=="light";var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
