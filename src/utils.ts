
export function sanitizeHtml(htmlString: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;

    // Remove script tags
    const scripts = tempDiv.getElementsByTagName('script');
    for (let i = scripts.length - 1; i >= 0; i--) {
        scripts[i].parentNode?.removeChild(scripts[i]);
    }

    // Remove event handlers (e.g., onclick, onmouseover)
    const elements = tempDiv.getElementsByTagName('*');
    for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const attributes = element.attributes;
        for (let j = attributes.length - 1; j >= 0; j--) {
            if (attributes[j].name.startsWith('on')) {
                element.removeAttribute(attributes[j].name);
            }
        }
    }

    return tempDiv.innerHTML;
}

export function stripHtml(html: string): string {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || "";
}

export function generateUniqueId(prefix: string = 'id'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
