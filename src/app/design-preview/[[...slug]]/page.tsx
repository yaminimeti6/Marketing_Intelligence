import { notFound } from 'next/navigation';
import Preview from '@/components/preview';
export default async function DesignPreview({params}: {params:Promise<{slug?:string[]}>}) {
  const {slug} = await params;
  const pages = ['overview','analytics','campaigns','attribution','reports','integrations','settings'];
  if (slug && (slug.length!==1 || !pages.includes(slug[0]))) notFound();
  return <Preview page={slug?.[0] ?? 'overview'}/>;
}
