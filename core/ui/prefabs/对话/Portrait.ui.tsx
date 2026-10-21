import type { UiReactComponentProps } from '../../../ui-document/uiDocument.types';
import { UiDialogueComponent } from '../../../ui-document/react/UiDialogueComponents';
import { dialogueUiMetadata } from '../metadata';
export default function Portrait(props: UiReactComponentProps) { return <UiDialogueComponent {...props} />; }
// eslint-disable-next-line react-refresh/only-export-components
export const ui = dialogueUiMetadata('portrait', '头像', { width: 390, height: 560 }, { fill: '#243a55', accent: '#68d5c3', cornerRadius: 28, fontSize: 112 });
