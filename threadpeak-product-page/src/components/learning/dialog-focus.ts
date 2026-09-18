import { useEffect,useRef,type KeyboardEvent } from 'react';
export function cycleDialogFocus(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab')
        return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(el => !el.hidden);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
    }
    else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
    }
}
export function useDialogFocus<T extends HTMLElement>(open = true) {
    const ref = useRef<T>(null);
    useEffect(() => { if (!open)
        return; const opener = document.activeElement as HTMLElement | null; ref.current?.querySelector<HTMLElement>('button:not(:disabled),textarea,input')?.focus(); return () => { if (opener?.isConnected)
        opener.focus(); }; }, [open]);
    return ref;
}
