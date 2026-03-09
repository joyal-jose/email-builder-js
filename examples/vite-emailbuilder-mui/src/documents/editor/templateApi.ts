import { EditorConfigurationSchema, TEditorConfiguration } from './core';

const TEMPLATE_API_URL = import.meta.env.VITE_TEMPLATE_API_URL;

type TFetchResponse = TEditorConfiguration | { document: TEditorConfiguration };

function assertApiUrl() {
    if (!TEMPLATE_API_URL) {
        throw new Error('Missing VITE_TEMPLATE_API_URL in environment variables.');
    }
    return TEMPLATE_API_URL;
}

function normalizeDocument(payload: TFetchResponse) {
    if ('document' in payload) {
        return payload.document;
    }
    return payload;
}

export async function fetchTemplateFromApi() {
    const url = assertApiUrl();
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Template fetch failed with status ${response.status}`);
    }

    const payload = (await response.json()) as TFetchResponse;
    const candidateDocument = normalizeDocument(payload);
    return EditorConfigurationSchema.parse(candidateDocument);
}

export async function saveTemplateToApi(document: TEditorConfiguration, html: string) {
    const url = assertApiUrl();
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({
            document,
            html,
        }),
    });

    if (!response.ok) {
        throw new Error(`Template save failed with status ${response.status}`);
    }
}
