export function CardAvatar({ src, name }: {
    src?: string;
    name: string;
}) {
    const photo = src && !src.includes('..') ? src : undefined;
    return <span className="learn-avatar"><span>{name.slice(0, 1)}</span>{photo && <img src={photo} alt="" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.visibility = 'hidden'; }}/>}</span>;
}
