import React, { type PropsWithChildren } from 'react';
import { classNames } from '~/utils/classNames';

const getTypeClass = (type?: 'primary' | 'secondary' | 'danger' | 'accent') => {
  switch (type) {
    case 'primary':
      return 'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-primary-backgroundHover';
    case 'secondary':
      return 'bg-bolt-elements-button-secondary-background text-bolt-elements-button-secondary-text hover:bg-bolt-elements-button-secondary-backgroundHover';
    case 'danger':
      return 'bg-bolt-elements-button-danger-background text-bolt-elements-button-danger-text hover:bg-bolt-elements-button-danger-backgroundHover';
    case 'accent':
      return 'bg-bolt-elements-button-accent-background text-bolt-elements-button-accent-text hover:bg-bolt-elements-button-accent-backgroundHover';
    default:
      return 'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-primary-backgroundHover';
  }
};

export default function Button({
  className,
  children,
  type,
  ...props
}: PropsWithChildren<
  {
    className?: string;
    type?: 'primary' | 'secondary' | 'danger' | 'accent';
  } & React.HTMLAttributes<HTMLButtonElement>
>) {
  return (
    <button
      className={classNames('rounded-lg px-4 py-2 mb-4 transition-colors duration-200', getTypeClass(type), className)}
      {...props}
    >
      {children}
    </button>
  );
}
