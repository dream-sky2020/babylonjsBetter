import type { UiReactComponentProps } from '../../../ui-document/uiDocument.types';
import { UiDialogueComponent } from '../../../ui-document/react/UiDialogueComponents';
import { dialogueUiMetadata } from '../metadata';
export default function DialogueBox(props: UiReactComponentProps) { return <UiDialogueComponent {...props} />; }
// eslint-disable-next-line react-refresh/only-export-components
export const ui = dialogueUiMetadata('dialogue-box', '对话框', { width: 760, height: 190 }, { fill: '#101625', cornerRadius: 26, fontSize: 34 });
