// Existing records were all bookmarks before the explicit flag was introduced.
export const isBookmarked=record=>Boolean(record)&&record.bookmarked!==false;
export const hasApplicationRecord=record=>isBookmarked(record)||Boolean(record.note?.trim())||record.status!=='관심';
