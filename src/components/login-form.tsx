'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { signIn } from '@/app/login/actions';

function Submit({ configured }: { configured: boolean }) {
  const { pending } = useFormStatus();
  return <button className="button primary" type="submit" disabled={!configured || pending}>{pending ? 'Signing in…' : 'Sign in securely'}</button>;
}

export default function LoginForm({ configured }: { configured: boolean }) {
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState('');
  const whitespace = password.length > 0 && password !== password.trim();
  const copiedLabel = password.startsWith('Password:');
  return <form action={signIn}>
    <label>Email address<input type="email" name="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required maxLength={254}/></label>
    <label>Password<input type={visible ? 'text' : 'password'} name="password" autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} required maxLength={256} value={password} onChange={event => setPassword(event.target.value)} aria-describedby={whitespace || copiedLabel ? 'password-copy-help' : undefined}/></label>
    <button className="text-button" type="button" aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? 'Hide password' : 'Show password'}</button>
    {(whitespace || copiedLabel) && <p id="password-copy-help" role="status" className="foundation-muted">{copiedLabel ? 'Copy only the password value, without the “Password:” label.' : 'There are spaces before or after the password. Check that they were not copied accidentally.'}</p>}
    <Submit configured={configured}/>
  </form>;
}
