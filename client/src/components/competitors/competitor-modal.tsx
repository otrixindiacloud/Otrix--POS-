import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { insertCompetitorSchema } from "@shared/schema";
import type { Competitor } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

interface CompetitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitor?: Competitor | null;
}

const competitorFormSchema = insertCompetitorSchema.extend({
  name: z.string().min(1, "Competitor name is required"),
});

type CompetitorFormData = z.infer<typeof competitorFormSchema>;

export default function CompetitorModal({
  isOpen,
  onClose,
  competitor,
}: CompetitorModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CompetitorFormData>({
    resolver: zodResolver(competitorFormSchema),
    defaultValues: {
      name: "",
      description: "",
      businessType: "retail",
      contactPerson: "",
      phone: "",
      email: "",
      website: "",
      address: "",
      city: "",
      country: "",
      notes: "",
      isActive: true,
    },
  });

  // Reset form when competitor changes or modal opens/closes
  React.useEffect(() => {
    if (competitor) {
      form.reset({
        name: competitor.name || "",
        description: competitor.description || "",
        businessType: (competitor.businessType as "retail" | "wholesale" | "online" | "mixed") || "retail",
        contactPerson: competitor.contactPerson || "",
        phone: competitor.phone || "",
        email: competitor.email || "",
        website: competitor.website || "",
        address: competitor.address || "",
        city: competitor.city || "",
        country: competitor.country || "",
        notes: competitor.notes || "",
        isActive: competitor.isActive ?? true,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        businessType: "retail",
        contactPerson: "",
        phone: "",
        email: "",
        website: "",
        address: "",
        city: "",
        country: "",
        notes: "",
        isActive: true,
      });
    }
  }, [competitor, isOpen, form]);

  const mutation = useMutation({
    mutationFn: async (data: CompetitorFormData) => {
      if (competitor) {
        const response = await apiRequest("PUT", `/api/competitors/${competitor.id}`, data);
        return await response.json();
      } else {
        const response = await apiRequest("POST", "/api/competitors", data);
        return await response.json();
      }
    },
    onSuccess: () => {
      toast({
        title: competitor ? "Competitor Updated" : "Competitor Added",
        description: `Competitor ${form.getValues().name} has been ${competitor ? "updated" : "added"} successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
      handleClose();
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        `Failed to ${competitor ? "update" : "create"} competitor`;
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CompetitorFormData) => {
    mutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {competitor ? "Edit Competitor" : "Add New Competitor"}
          </DialogTitle>
          <DialogDescription>
            {competitor
              ? "Update competitor details and information"
              : "Enter competitor details to track their pricing and market position."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Competitor Name */}
          <div>
            <Label htmlFor="name" className="text-sm font-medium">
              Competitor Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="e.g., SuperMart Qatar"
              className="mt-1"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              {...form.register("description")}
              placeholder="Brief description of the competitor"
              rows={3}
              className="mt-1 resize-y"
            />
          </div>

          {/* Business Type and Contact Person */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="businessType" className="text-sm font-medium">
                Business Type
              </Label>
              <Select
                value={form.watch("businessType") || "retail"}
                onValueChange={(value) =>
                  form.setValue("businessType", value as "retail" | "wholesale" | "online" | "mixed")
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="contactPerson" className="text-sm font-medium">
                Contact Person
              </Label>
              <Input
                id="contactPerson"
                {...form.register("contactPerson")}
                placeholder="Primary contact name"
                className="mt-1"
              />
            </div>
          </div>

          {/* Phone and Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone" className="text-sm font-medium">
                Phone
              </Label>
              <Input
                id="phone"
                type="tel"
                {...form.register("phone")}
                placeholder="+974 XXXX XXXX"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                {...form.register("email")}
                placeholder="contact@example.com"
                className="mt-1"
              />
            </div>
          </div>

          {/* Website */}
          <div>
            <Label htmlFor="website" className="text-sm font-medium">
              Website
            </Label>
            <Input
              id="website"
              type="url"
              {...form.register("website")}
              placeholder="https://www.example.com"
              className="mt-1"
            />
          </div>

          {/* Address */}
          <div>
            <Label htmlFor="address" className="text-sm font-medium">
              Address
            </Label>
            <Input
              id="address"
              {...form.register("address")}
              placeholder="Street address"
              className="mt-1"
            />
          </div>

          {/* City and Country */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city" className="text-sm font-medium">
                City
              </Label>
              <Input
                id="city"
                {...form.register("city")}
                placeholder="e.g., Doha"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="country" className="text-sm font-medium">
                Country
              </Label>
              <Input
                id="country"
                {...form.register("country")}
                placeholder="e.g., Qatar"
                className="mt-1"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-sm font-medium">
              Notes
            </Label>
            <Textarea
              id="notes"
              {...form.register("notes")}
              placeholder="Additional notes about this competitor"
              rows={3}
              className="mt-1 resize-y"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="bg-white hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {mutation.isPending
                ? "Saving..."
                : competitor
                  ? "Update Competitor"
                  : "Add Competitor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

