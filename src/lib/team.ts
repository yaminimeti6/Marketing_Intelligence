export function teamName(value:string,max=100){const name=value.trim();if(!name||name.length>max||/[\x00-\x1f\x7f]/.test(value))throw new Error('team_input');return name;}
export function teamEmail(value:string){const email=value.trim().toLowerCase();if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('team_input');return email;}
export function inviteToken(value:string){if(!/^[A-Za-z0-9_-]{43}$/.test(value))throw new Error('team_invite_invalid');return value;}
export function teamPreferences(currency:string,timezone:string){
 if(currency&&!Intl.supportedValuesOf('currency').includes(currency))throw new Error('team_input');
 if(timezone){if(timezone.length>100)throw new Error('team_input');try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{throw new Error('team_input');}}
 return {currency:currency||null,timezone:timezone||null};
}
export function teamErrorMessage(error:unknown){
 const message=error instanceof Error?error.message:'';
 const messages:Record<string,string>={team_attempt_limit:'Too many attempts. Wait 15 minutes before trying again.',team_last_owner:'The last Owner cannot be removed or downgraded. Make another member an Owner first.',team_already_member:'This email is already a workspace member. Use member roles instead.',team_limit:'Invitation limit reached: at most 10 creations per hour or 100 active invitations per workspace. Revoking links does not reset the hourly limit. Wait for earlier creations to age out, or revoke unused links if the active limit is reached.',team_credentials:'Credentials did not match. Existing accounts must use their current password or sign in with the invited account.',team_invite_invalid:'This invitation is invalid, expired, revoked or already accepted. Ask the workspace administrator for a new link.',team_permission:'Your current role cannot perform this action.',team_input:'Check the required fields, lengths and selected values.'};
 for(const [code,text] of Object.entries(messages))if(message.includes(code))return text;
 return 'The action could not complete. Refresh and try again. No success is claimed.';
}
