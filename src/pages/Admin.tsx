import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Database, TrendingUp, TrendingDown, Users, ShoppingBag } from "lucide-react";
import { getAllOfferLogs, getOfferSummaryBySku, OfferLog, OfferSummary } from '@/lib/offerLogs';

const Admin = () => {
  const [offerLogs, setOfferLogs] = useState<OfferLog[]>([]);
  const [offerSummary, setOfferSummary] = useState<OfferSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [logsData, summaryData] = await Promise.all([
        getAllOfferLogs(),
        getOfferSummaryBySku()
      ]);
      
      setOfferLogs(logsData);
      setOfferSummary(summaryData);
    } catch (err) {
      console.error('Error loading admin data:', err);
      setError('Error loading data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString()}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Badge className="bg-green-100 text-green-800">Accepted</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const getCouponStatus = (log: OfferLog) => {
    if (log.offer_status !== 'accepted') return 'N/A';
    
    const now = new Date();
    const createdAt = new Date(log.created_at);
    const thirtyMinutesAfterCreation = new Date(createdAt.getTime() + 30 * 60 * 1000);
    
    // If marked as redeemed, it's used
    if (log.is_redeemed) return 'usado';
    
    // If 30 minutes have passed and not redeemed, it's cancelled
    if (now > thirtyMinutesAfterCreation) return 'cancelado';
    
    // Otherwise it's still pending
    return 'pendiente';
  };

  const getCouponStatusBadge = (status: string) => {
    switch (status) {
      case 'pendiente':
        return <Badge className="bg-green-100 text-green-800">Pendiente</Badge>;
      case 'usado':
        return <Badge className="bg-blue-100 text-blue-800">Usado</Badge>;
      case 'cancelado':
        return <Badge className="bg-gray-100 text-gray-800">Cancelado</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const getTotalStats = () => {
    const totalOffers = offerLogs.length;
    const acceptedOffers = offerLogs.filter(log => log.offer_status === 'accepted').length;
    const rejectedOffers = offerLogs.filter(log => log.offer_status === 'rejected').length;
    const overallAcceptanceRate = totalOffers > 0 ? Math.round((acceptedOffers / totalOffers) * 100) : 0;
    
    return { totalOffers, acceptedOffers, rejectedOffers, overallAcceptanceRate };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadData} className="bg-purple-600 text-white">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const stats = getTotalStats();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ShuQ Admin Dashboard</h1>
          <p className="text-gray-600">Monitor offer logs and performance metrics</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Offers</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalOffers}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <ShoppingBag className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Accepted</p>
                <p className="text-3xl font-bold text-green-600">{stats.acceptedOffers}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-3xl font-bold text-red-600">{stats.rejectedOffers}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Acceptance Rate</p>
                <p className="text-3xl font-bold text-purple-600">{stats.overallAcceptanceRate}%</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="summary" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Summary by SKU
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Raw Offer Logs
            </TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary">
            <Card>
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Offer Summary by Product SKU</h2>
                <div className="overflow-x-auto">
                  <Table>
                                         <TableHeader>
                       <TableRow>
                         <TableHead>SKU</TableHead>
                         <TableHead>Product Name</TableHead>
                         <TableHead className="text-right">List Price</TableHead>
                         <TableHead className="text-right">Avg. Offered</TableHead>
                         <TableHead className="text-center">Avg. Discount</TableHead>
                         <TableHead className="text-center">Total Offers</TableHead>
                         <TableHead className="text-center">Accepted</TableHead>
                         <TableHead className="text-center">Rejected</TableHead>
                         <TableHead className="text-center">Acceptance Rate</TableHead>
                       </TableRow>
                     </TableHeader>
                    <TableBody>
                                             {offerSummary.map((summary) => {
                         const avgDiscountPercentage = Math.round((summary.product_price - summary.average_offered_price) / summary.product_price * 100);
                         
                         return (
                           <TableRow key={summary.product_sku}>
                             <TableCell className="font-mono text-sm">{summary.product_sku}</TableCell>
                             <TableCell className="font-medium">{summary.product_name}</TableCell>
                             <TableCell className="text-right font-semibold">
                               {formatCurrency(summary.product_price)}
                             </TableCell>
                             <TableCell className="text-right">
                               <div className="flex flex-col items-end">
                                 <span className="font-medium">{formatCurrency(summary.average_offered_price)}</span>
                                 <span className="text-xs text-gray-500">
                                   ({Math.round((summary.average_offered_price / summary.product_price) * 100)}% of list)
                                 </span>
                               </div>
                             </TableCell>
                             <TableCell className="text-center">
                               <span className="font-semibold text-purple-600">{avgDiscountPercentage}%</span>
                             </TableCell>
                             <TableCell className="text-center">{summary.total_offers}</TableCell>
                             <TableCell className="text-center">
                               <span className="text-green-600 font-semibold">{summary.accepted_offers}</span>
                             </TableCell>
                             <TableCell className="text-center">
                               <span className="text-red-600 font-semibold">{summary.rejected_offers}</span>
                             </TableCell>
                             <TableCell className="text-center">
                               <div className="flex items-center justify-center gap-2">
                                 <div className={`w-2 h-2 rounded-full ${
                                   summary.acceptance_rate >= 50 ? 'bg-green-500' : 
                                   summary.acceptance_rate >= 25 ? 'bg-yellow-500' : 'bg-red-500'
                                 }`}></div>
                                 <span className="font-semibold">{summary.acceptance_rate}%</span>
                               </div>
                             </TableCell>
                           </TableRow>
                         );
                       })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Raw Logs Tab */}
          <TabsContent value="logs">
            <Card>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Raw Offer Logs</h2>
                  <Button onClick={loadData} variant="outline" size="sm">
                    Refresh
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Session ID</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Original Price</TableHead>
                        <TableHead>Offered Amount</TableHead>
                        <TableHead>Discount %</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Coupon Status</TableHead>
                        <TableHead>Attempts Left</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Expires</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {offerLogs.map((log) => {
                        const discountPercentage = Math.round((log.product_price - log.offered_amount) / log.product_price * 100);
                        const couponStatus = getCouponStatus(log);
                        
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm">
                              {formatDate(log.created_at)}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-gray-600 max-w-24 truncate">
                              {log.session_id}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{log.product_sku}</TableCell>
                            <TableCell className="max-w-48 truncate">{log.product_name}</TableCell>
                            <TableCell>{formatCurrency(log.product_price)}</TableCell>
                            <TableCell className="font-semibold">{formatCurrency(log.offered_amount)}</TableCell>
                            <TableCell className="text-center font-semibold">
                              {discountPercentage}%
                            </TableCell>
                            <TableCell>{getStatusBadge(log.offer_status)}</TableCell>
                            <TableCell>{getCouponStatusBadge(couponStatus)}</TableCell>
                            <TableCell className="text-center">{log.attempts_remaining}</TableCell>
                            <TableCell className="font-mono text-sm">
                              {log.acceptance_code || '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {log.expires_at ? formatDate(log.expires_at) : '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin; 