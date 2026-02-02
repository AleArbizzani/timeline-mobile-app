import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import HeaderBase from './HeaderBase';
import HeaderTitleRow from './HeaderTitleRow';
import HeaderIconButton from './HeaderIconButton';

export default function ModalHeader({ title, onClose, style }) {
  const rightSlot = (
    <HeaderIconButton
      onPress={onClose}
      backgroundColor={colors.racing}
    >
      <Ionicons name="close" size={16} color={colors.ivory} />
    </HeaderIconButton>
  );

  return (
    <HeaderBase style={style}>
      <HeaderTitleRow title={title} rightSlot={rightSlot} />
    </HeaderBase>
  );
}
