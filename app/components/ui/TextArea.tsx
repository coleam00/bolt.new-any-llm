import React from 'react';
import { classNames } from '~/utils/classNames';

export default function TextArea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={classNames(
        'w-full bg-white dark:bg-bolt-elements-background-depth-4 relative px-2 py-1.5 rounded-md',
        'focus:outline-none placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary',
        'border border-bolt-elements-borderColor',
        className,
      )}
      {...props}
    />
  );
}
