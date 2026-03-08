import { FileText, Link as LinkIcon, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { listDocuments, listProperties, type DocumentRecord } from "@/lib/backend-api";
import { getRoleFromCookie, getSessionTokenFromCookie } from "@/lib/cookie-utils";
import { AddDocumentButton, DocumentRowActions } from "./document-actions";
import Link from "next/link";

function typeBadge(type: string | undefined) {
  return (
    <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-white/5 border border-white/10 text-neutral-300">
      {type?.replace(/_/g, " ") ?? "—"}
    </span>
  );
}

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { redirect } from "next/navigation";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const role = await getRoleFromCookie();
  const token = await getSessionTokenFromCookie();
  const sessionToken = token || "";

  const resolvedParams = await searchParams;
  const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1;
  const search = resolvedParams.search || "";

  const [documentsResult, propertiesResult] = await Promise.all([
    listDocuments(sessionToken, { page, search }),
    listProperties(sessionToken, { limit: 100 }),
  ]);

  const documentsData = documentsResult.data;
  const documents: DocumentRecord[] = documentsData?.data ?? [];
  const meta = documentsData?.meta;

  const properties = propertiesResult.data?.data ?? [];

  const onSearchAction = async (formData: FormData) => {
    "use server";
    const query = formData.get("search") as string;
    if (query) {
      redirect(`/admin/documents?search=${encodeURIComponent(query)}`);
    } else {
      redirect("/admin/documents");
    }
  };

  const onPageChangeAction = async (newPage: number) => {
    "use server";
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", newPage.toString());
    redirect(`/admin/documents?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Page header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-md">
            Documents
          </h1>
          <p className="text-neutral-400 text-sm font-medium">
            Manage lease files, agreements, and compliance records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500 pointer-events-none" />
            <form action={onSearchAction}>
              <input
                name="search"
                placeholder="Search documents..."
                defaultValue={search}
                className="h-9 w-[220px] rounded-md border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-neutral-500 focus:border-white/30 focus:outline-none"
              />
            </form>
          </div>
          <AddDocumentButton role={role} properties={properties} />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">All Documents</CardTitle>
          <CardDescription className="text-neutral-400">
            Click on the link icon to open the document file.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            <div className="col-span-4">Document Details</div>
            <div className="col-span-3 hidden md:block">Type</div>
            <div className="col-span-3 hidden lg:block">Linked Entity</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          <div className="divide-y divide-white/5">
            {documents.length === 0 && (
              <div className="px-6 py-8 text-center text-sm text-neutral-500">
                No documents found. {search ? "Try a different search." : "Click Add Document to get started."}
              </div>
            )}

            {documents.map((doc) => {
              const matchedProperty = properties.find((p) => p.id === doc.propertyId);

              return (
                <div key={doc.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-white/5 transition-colors cursor-pointer group">
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-neutral-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{doc.name}</p>
                      <p className="text-xs text-neutral-500 truncate">{doc.description || "No description"}</p>
                    </div>
                  </div>

                  <div className="col-span-3 hidden md:block">
                    {typeBadge(doc.type)}
                  </div>

                  <div className="col-span-3 hidden lg:block">
                    {matchedProperty ? (
                      <div>
                        <p className="text-sm font-medium text-white truncate">{matchedProperty.name}</p>
                        <p className="text-xs text-neutral-400">Property</p>
                      </div>
                    ) : (
                      <span className="text-sm text-neutral-600">—</span>
                    )}
                  </div>

                  <div className="col-span-2 flex justify-end gap-2 items-center">
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                      title="Open Document"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <LinkIcon className="h-4 w-4" />
                    </a>
                    <DocumentRowActions role={role} document={doc} properties={properties} />
                  </div>
                </div>
              );
            })}
          </div>

          {meta && (
            <div className="px-6 border-t border-white/10">
              <Pagination
                currentPage={meta.page}
                totalPages={meta.totalPages}
                onPageChange={onPageChangeAction}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
