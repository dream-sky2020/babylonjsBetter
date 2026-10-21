import type { UiReactComponentProps } from '../../../ui-document/uiDocument.types';
import { uiBasicReactComponents } from '../../../ui-document/UiDocumentView';
import { basicUiMetadata } from '../metadata';
const Basic = uiBasicReactComponents['label'];
export default function Label(props: UiReactComponentProps) { return <Basic {...props} />; }
// eslint-disable-next-line react-refresh/only-export-components
export const ui = basicUiMetadata('label');
