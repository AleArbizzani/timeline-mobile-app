import { forwardRef } from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { colors, typography } from '../theme';

const SingleLineInput = forwardRef(({ style, ...props }, ref) => {
  return (
    <TextInput
      ref={ref}
      style={[styles.input, style]}
      placeholderTextColor={colors.darkGrey}
      {...props}
    />
  );
});

SingleLineInput.displayName = 'SingleLineInput';

const styles = StyleSheet.create({
  input: {
    height: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.black,
    backgroundColor: colors.ivory,
    color: colors.black,
    ...typography.input.singleLine,
  },
});

export default SingleLineInput;
