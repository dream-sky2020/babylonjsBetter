import type { UiReactComponentProps } from '../../../ui-document/uiDocument.types';
import { UiDialogueComponent } from '../../../ui-document/react/UiDialogueComponents';
import { dialogueUiMetadata } from '../metadata';
export default function Icon(props: UiReactComponentProps) { return <UiDialogueComponent {...props} />; }
// eslint-disable-next-line react-refresh/only-export-components
export const ui = dialogueUiMetadata('icon', '图标', { width: 48, height: 48 }, { cornerRadius: 21, fontSize: 20 });
