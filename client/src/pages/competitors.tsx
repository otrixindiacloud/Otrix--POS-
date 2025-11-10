import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Edit,
  Trash2,
  Globe,
  Phone,
  Mail,
  MapPin,
  Upload,
  Plus,
  Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Competitor } from "@shared/schema";
import CompetitorImportModal from "@/components/competitors/competitor-import-modal";
import CompetitorModal from "@/components/competitors/competitor-modal";
import CompetitorDetailModal from "@/components/competitors/competitor-detail-modal";

interface CompetitorWithStats extends Competitor {
  priceCount: number;
}

export default function CompetitorsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<CompetitorWithStats | null>(null);


  // Fetch competitors
  const { data: competitors = [], isLoading } = useQuery<CompetitorWithStats[]>({
    queryKey: ["competitors"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/competitors");
      return await response.json();
    },
  });


  // Delete competitor mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/competitors/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
      toast({
        title: "Success",
        description: "Competitor removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove competitor",
        variant: "destructive",
      });
    },
  });


  const handleEdit = (competitor: CompetitorWithStats) => {
    setSelectedCompetitor(competitor);
    setIsEditModalOpen(true);
  };

  const handleViewDetails = (competitor: CompetitorWithStats) => {
    setSelectedCompetitor(competitor);
    setIsDetailModalOpen(true);
  };


  const handleDelete = (id: number, name: string) => {
    if (confirm(`Are you sure you want to remove ${name}?`)) {
      deleteMutation.mutate(id);
    }
  };

  const filteredCompetitors = competitors.filter((competitor) =>
    competitor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (competitor.city && competitor.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (competitor.email && competitor.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getBusinessTypeColor = (type: string | null) => {
    switch (type) {
      case "retail":
        return "bg-blue-100 text-blue-800";
      case "wholesale":
        return "bg-purple-100 text-purple-800";
      case "online":
        return "bg-green-100 text-green-800";
      case "mixed":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };


  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Competitors</h1>
            <p className="text-gray-600 mt-1">
              Manage competitor information and track their pricing
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              Add Competitor
            </Button>
            <Button
              onClick={async () => {
                // Check if ansargallery already exists
                const ansargallery = competitors.find(
                  (c) => c.name.toLowerCase().includes("ansargallery") || c.name.toLowerCase().includes("ansar")
                );
                
                if (ansargallery) {
                  // If exists, open import modal with that competitor selected
                  setIsImportModalOpen(true);
                } else {
                  // Create ansargallery competitor first
                  try {
                    const response = await apiRequest("POST", "/api/competitors", {
                      name: "Ansargallery",
                      description: "Ansargallery E-commerce Portal",
                      website: "https://ansargallery.com",
                      businessType: "online",
                      isActive: true,
                    });
                    const newCompetitor = await response.json();
                    queryClient.invalidateQueries({ queryKey: ["competitors"] });
                    toast({
                      title: "Ansargallery Added",
                      description: "Ansargallery competitor created successfully",
                    });
                    setIsImportModalOpen(true);
                  } catch (error: any) {
                    toast({
                      title: "Error",
                      description: error.message || "Failed to create ansargallery competitor",
                      variant: "destructive",
                    });
                  }
                }
              }}
              variant="outline"
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              Import Products
            </Button>
            <Button
              onClick={async () => {
                // Quick action: Add ansargallery and scrape
                try {
                  // Check if ansargallery exists
                  let ansargallery = competitors.find(
                    (c) => c.name.toLowerCase().includes("ansargallery") || c.name.toLowerCase().includes("ansar")
                  );
                  
                  if (!ansargallery) {
                    const response = await apiRequest("POST", "/api/competitors", {
                      name: "Ansargallery",
                      description: "Ansargallery E-commerce Portal",
                      website: "https://ansargallery.com",
                      businessType: "online",
                      isActive: true,
                    });
                    ansargallery = await response.json();
                    await queryClient.invalidateQueries({ queryKey: ["competitors"] });
                  }
                  
                  // Open import modal with ansargallery selected
                  setSelectedCompetitor(ansargallery as any);
                  setIsImportModalOpen(true);
                  toast({
                    title: "Ready to Scrape",
                    description: "Select 'Scrape Portal' method and enter ansargallery URL",
                  });
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message || "Failed to setup ansargallery",
                    variant: "destructive",
                  });
                }
              }}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Search className="w-4 h-4" />
              Add Ansargallery
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Competitors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{competitors.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Active Tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {competitors.filter((c) => c.isActive).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Products Tracked
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {competitors.reduce((sum, c) => sum + (c.priceCount || 0), 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Avg Products/Competitor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {competitors.length > 0
                  ? Math.round(
                      competitors.reduce((sum, c) => sum + (c.priceCount || 0), 0) /
                        competitors.length
                    )
                  : 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search competitors by name, city, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading competitors...</div>
            ) : filteredCompetitors.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? "No competitors found matching your search" : "No competitors added yet"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competitor</TableHead>
                    <TableHead>Business Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-center">Products Tracked</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompetitors.map((competitor) => (
                    <TableRow key={competitor.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900">{competitor.name}</div>
                          {competitor.description && (
                            <div className="text-sm text-gray-500 mt-0.5">
                              {competitor.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getBusinessTypeColor(competitor.businessType)}>
                          {competitor.businessType || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {competitor.phone && (
                            <div className="flex items-center gap-1 text-gray-600">
                              <Phone className="w-3 h-3" />
                              {competitor.phone}
                            </div>
                          )}
                          {competitor.email && (
                            <div className="flex items-center gap-1 text-gray-600">
                              <Mail className="w-3 h-3" />
                              {competitor.email}
                            </div>
                          )}
                          {competitor.website && (
                            <div className="flex items-center gap-1 text-blue-600">
                              <Globe className="w-3 h-3" />
                              <a
                                href={competitor.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                              >
                                Website
                              </a>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {competitor.city || competitor.country ? (
                          <div className="flex items-start gap-1 text-sm text-gray-600">
                            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <div>
                              {competitor.city}
                              {competitor.city && competitor.country && ", "}
                              {competitor.country}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{competitor.priceCount || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={competitor.isActive ? "default" : "secondary"}
                        >
                          {competitor.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(competitor)}
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(competitor)}
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(competitor.id, competitor.name)}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Competitor Modal */}
      <CompetitorModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setSelectedCompetitor(null);
        }}
        competitor={null}
      />

      {/* Edit Competitor Modal */}
      <CompetitorModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedCompetitor(null);
        }}
        competitor={selectedCompetitor}
      />

      {/* Import Modal */}
      <CompetitorImportModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setSelectedCompetitor(null);
          queryClient.invalidateQueries({ queryKey: ["competitors"] });
        }}
        initialCompetitor={selectedCompetitor}
      />

      {/* Detail Modal */}
      {selectedCompetitor && (
        <CompetitorDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedCompetitor(null);
          }}
          competitor={selectedCompetitor}
        />
      )}
    </MainLayout>
  );
}
