// Feedback läuft über ein Microsoft-Forms-Formular im Schul-Tenant (nur sluz), nicht über die Tools.
const FORM = 'https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=uFguxql99EGD8zou2CSZrGlaDHPrcIBBnGS44v7Vf3xUNDFEWUtTQUtLWE4zNlhJMUJMSFY3NE01MC4u';
const FELD_TOOL = 'r4648ddf3572d4c20af02bd380f4486a1';

/** Link aufs Formular mit vorausgewähltem Tool. `tool` muss genau einer Option der Frage «Tool» entsprechen. */
export const feedbackUrl = (tool: string): string => `${FORM}&${FELD_TOOL}=${encodeURIComponent(JSON.stringify(tool))}`;
