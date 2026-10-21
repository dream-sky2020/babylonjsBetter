import type { UiReactComponentProps } from '../../../ui-document/uiDocument.types';
import { UiDialogueComponent } from '../../../ui-document/react/UiDialogueComponents';
import { dialogueUiMetadata } from '../metadata';
export default function Text(props: UiReactComponentProps) { return <UiDialogueComponent {...props} />; }
// eslint-disable-next-line react-refresh/only-export-components
export const ui = dialogueUiMetadata('text', '文字', { width: 360, height: 60 }, {});
