import type { UiReactComponentProps } from '../../../ui-document/uiDocument.types';
import { UiDialogueComponent } from '../../../ui-document/react/UiDialogueComponents';
import { dialogueUiMetadata } from '../metadata';
export default function Nameplate(props: UiReactComponentProps) { return <UiDialogueComponent {...props} />; }
// eslint-disable-next-line react-refresh/only-export-components
export const ui = dialogueUiMetadata('nameplate', '姓名牌', { width: 226, height: 68 }, {});
