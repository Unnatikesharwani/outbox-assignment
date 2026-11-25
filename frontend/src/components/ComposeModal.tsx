import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { extractEmails } from '../lib/csv';
import { toLocalInputValue } from '../lib/format';
import { Button } from './ui/Button';
import { Field, Input, Textarea } from './ui/Input';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onScheduled: () => void;
}

const defaults = () => ({
  subject: '',
  body: '',
  start: toLocalInputValue(new Date(Date.now() + 5 * 60 * 1000)),
  delay: '5',
  hourlyLimit: '100',
});

export function ComposeModal({ open, onClose, onScheduled }: Props) {
  const toast = useToast();
  const [form, setForm] = useState(defaults);
  const [fileName, setFileName] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // fresh form each time the modal opens
  useEffect(() => {
    if (open) {
      setForm(defaults());
      setFileName('');
      setRecipients([]);
      setErrors({});
    }
  }, [open]);

  const set = (key: keyof ReturnType<typeof defaults>) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const found = extractEmails(await file.text());
    setFileName(file.name);
    setRecipients(found);
    setErrors((prev) => ({ ...prev, file: '' }));
    if (!found.length) toast('No email addresses found in that file', 'error');
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.subject.trim()) errs.subject = 'Add a subject';
    if (!form.body.trim()) errs.body = 'Write the email body';
    if (!recipients.length) errs.file = 'Upload a CSV or text file with at least one email address';
    if (!form.start || Number.isNaN(new Date(form.start).getTime())) errs.start = 'Pick a start time';
    if (Number(form.delay) < 0 || form.delay === '') errs.delay = 'Enter 0 or more seconds';
    if (Number(form.hourlyLimit) < 1) errs.hourlyLimit = 'Must be at least 1';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await api.schedule({
        subject: form.subject.trim(),
        body: form.body.trim(),
        recipients,
        startTime: new Date(form.start).toISOString(),
        delaySeconds: Number(form.delay),
        hourlyLimit: Number(form.hourlyLimit),
      });
      toast(`Scheduled ${res.scheduled} email${res.scheduled === 1 ? '' : 's'}`);
      onScheduled();
      onClose();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Compose new email">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Subject" error={errors.subject}>
          <Input value={form.subject} onChange={set('subject')} placeholder="Quick question about your onboarding" />
        </Field>
        <Field label="Body" error={errors.body}>
          <Textarea rows={5} value={form.body} onChange={set('body')} placeholder="Hi there, …" />
        </Field>

        <Field
          label="Leads"
          error={errors.file}
          hint={recipients.length ? undefined : 'CSV or .txt – any column, we pick out the email addresses.'}
        >
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-ink-300 p-3">
            <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={onFile} className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700" />
          </div>
          {fileName && (
            <p className="mt-2 text-sm text-ink-700">
              <span className="font-semibold text-brand-700">{recipients.length}</span> email address{recipients.length === 1 ? '' : 'es'} found in {fileName}
            </p>
          )}
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Start time" error={errors.start}>
            <Input type="datetime-local" value={form.start} onChange={set('start')} />
          </Field>
          <Field label="Delay (seconds)" error={errors.delay} hint="Gap between emails">
            <Input type="number" min={0} value={form.delay} onChange={set('delay')} />
          </Field>
          <Field label="Hourly limit" error={errors.hourlyLimit} hint="Per sender">
            <Input type="number" min={1} value={form.hourlyLimit} onChange={set('hourlyLimit')} />
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {recipients.length ? `Schedule ${recipients.length} emails` : 'Schedule'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
