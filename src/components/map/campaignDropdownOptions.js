import React from 'react';

const text = children => React.Children.toArray(children).map(child => React.isValidElement(child) ? text(child.props.children) : String(child)).join('');

export default function campaignDropdownOptions(children, group = '', disabled = false) {
  return React.Children.toArray(children).flatMap(child => {
    if (!React.isValidElement(child)) return [];
    const props = child.props;
    if (child.type === 'option') return props.hidden ? [] : [{
      value: String(props.value ?? text(props.children)),
      label: props.label ?? text(props.children),
      disabled: disabled || props.disabled,
      group,
    }];
    return campaignDropdownOptions(props.children, props.label || group, disabled || props.disabled);
  });
}