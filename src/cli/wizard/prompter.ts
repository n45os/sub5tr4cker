export interface WizardSelectOption {
  value: string;
  label: string;
  hint?: string;
}

export interface WizardPrompter {
  intro(title: string): Promise<void>;
  outro(message: string): Promise<void>;
  note(message: string, title?: string): Promise<void>;
  text(params: {
    message: string;
    placeholder?: string;
    initialValue?: string;
    validate?: (value: string) => string | undefined;
  }): Promise<string>;
  select(params: {
    message: string;
    initialValue?: string;
    options: WizardSelectOption[];
  }): Promise<string>;
  confirm(params: {
    message: string;
    initialValue?: boolean;
  }): Promise<boolean>;
}
