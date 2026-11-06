                                                                                 
export function effectiveUser(user, now) {
 if (user?.status === 'suspended' && Number.isSafeInteger(user.restrictionUntil) && user.restrictionUntil > 0 && user.restrictionUntil <= now)
  return {...user, status:'active', restrictionUntil:null, restrictionReason:''};
 return user;
}
