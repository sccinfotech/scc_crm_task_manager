import React from 'react'
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  type DocumentProps,
} from '@react-pdf/renderer'
import type { Quotation, QuotationRequirement } from '@/lib/quotations/actions'

const COMPANY_PROFILE = {
  name: 'SCC INFOTECH',
  address:
    '349-350, Vikas Shoppers, B/H Filter House Bhagvan Nagar Circle, near Sarthana Jakat Naka, Nana Varachha, Surat, Gujarat 395006',
  phone: '9974361458',
  email: 'vipul@sccinfotech.com',
  website: 'www.sccinfotech.com',
  gstin: null as string | null,
}

const GST_NOTE = 'Applicable GST will be charged extra as per prevailing government regulations.'
const SCC_LOGO_PATH = `${process.cwd()}/public/scc_logo.png`

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 34,
    paddingHorizontal: 36,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    fontSize: 10.5,
    fontFamily: 'Helvetica',
    lineHeight: 1.45,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeftBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  headerRightBlock: {
    width: 220,
  },
  headerAddressText: {
    textAlign: 'left',
    color: '#334155',
    marginBottom: 2,
  },
  dividerBlue: {
    height: 4,
    backgroundColor: '#5AADE2',
    marginTop: 10,
    marginBottom: 16,
  },
  quoteMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  quoteMetaText: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  preparedTable: {
    borderWidth: 1,
    borderColor: '#4B5563',
    marginBottom: 22,
  },
  preparedTableRow: {
    flexDirection: 'row',
  },
  preparedHeaderCell: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: '#4B5563',
    borderBottomWidth: 1,
    borderBottomColor: '#4B5563',
  },
  preparedHeaderCellLast: {
    borderRightWidth: 0,
  },
  preparedHeaderText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  preparedBodyCell: {
    flex: 1,
    minHeight: 62,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: '#4B5563',
  },
  preparedBodyCellLast: {
    borderRightWidth: 0,
  },
  preparedBodyPrimary: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 3,
  },
  preparedBodyText: {
    color: '#334155',
    marginBottom: 2,
  },
  introBlock: {
    marginBottom: 16,
  },
  introGreetingLine: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 8,
  },
  introCentered: {
    color: '#334155',
    lineHeight: 1.5,
    marginBottom: 7,
  },
  contentSection: {
    marginTop: 14,
  },
  footerBlueLine: {
    height: 5,
    backgroundColor: '#5AADE2',
    marginTop: 20,
    marginBottom: 12,
  },
  footerContactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerWebsite: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#3B82F6',
  },
  footerContacts: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1F2937',
  },
  heroCard: {
    borderWidth: 1,
    borderColor: '#D7E6F0',
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#F8FBFD',
    marginBottom: 18,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoWrap: {
    width: 58,
    height: 58,
    marginRight: 14,
  },
  brandLabel: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0EA5E9',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  brandName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 3,
  },
  brandSubtext: {
    fontSize: 9.5,
    color: '#475569',
  },
  documentMeta: {
    alignItems: 'flex-end',
    maxWidth: 180,
  },
  documentTitle: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 5,
  },
  documentSubtitle: {
    fontSize: 9.5,
    color: '#64748B',
    marginBottom: 2,
  },
  accentLine: {
    height: 3,
    backgroundColor: '#0EA5E9',
    borderRadius: 999,
    marginBottom: 14,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailPanel: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 13,
    backgroundColor: '#FFFFFF',
  },
  detailPanelLeft: {
    marginRight: 9,
  },
  detailPanelRight: {
    marginLeft: 9,
  },
  detailPanelHeading: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.8,
    color: '#0891B2',
    marginBottom: 8,
  },
  detailPanelName: {
    fontSize: 13.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 5,
  },
  detailPanelText: {
    marginBottom: 3.5,
    color: '#334155',
  },
  quoteMeta: {
    flexDirection: 'row',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  metaPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#E0F2FE',
    color: '#0C4A6E',
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
  },
  metaPillSpacing: {
    marginRight: 8,
    marginBottom: 6,
  },
  section: {
    marginTop: 16,
  },
  sectionHeading: {
    fontSize: 13.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F4C81',
    marginBottom: 10,
  },
  sectionLead: {
    color: '#64748B',
    marginBottom: 10,
  },
  introCard: {
    padding: 0,
    marginTop: 2,
  },
  paragraph: {
    color: '#334155',
    marginBottom: 8,
  },
  requirementCard: {
    padding: 0,
    marginBottom: 12,
  },
  requirementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  requirementIndexWrap: {
    marginRight: 12,
  },
  requirementIndex: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#CFFAFE',
    color: '#155E75',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    paddingTop: 5,
  },
  requirementTitleWrap: {
    flex: 1,
  },
  requirementTitle: {
    fontSize: 11.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  pricingBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#ECFEFF',
    color: '#155E75',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  requirementMetaText: {
    marginTop: 6,
    color: '#475569',
  },
  pricingCard: {
    padding: 0,
    marginBottom: 12,
  },
  pricingTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 7,
  },
  pricingLineLabel: {
    fontSize: 7.8,
    fontFamily: 'Helvetica-Bold',
    color: '#64748B',
    marginBottom: 2,
  },
  pricingLineValue: {
    fontSize: 9.6,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    marginBottom: 5,
  },
  milestoneTable: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
  },
  milestoneHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  milestoneRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  milestoneCellWide: {
    flex: 2.2,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  milestoneCell: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  milestoneHeadText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#334155',
  },
  milestoneText: {
    fontSize: 8.7,
    color: '#0F172A',
  },
  summaryGrid: {
    marginTop: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#D7E3EC',
  },
  summaryRowStrong: {
    borderTopWidth: 1,
    borderTopColor: '#94A3B8',
    marginTop: 4,
    paddingTop: 8,
  },
  summaryLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#334155',
  },
  summaryValue: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
  },
  listItemRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  listBullet: {
    width: 11,
    color: '#0891B2',
    fontFamily: 'Helvetica-Bold',
  },
  listText: {
    flex: 1,
    color: '#334155',
    marginLeft: 8,
  },
  noticeBox: {
    marginTop: 16,
  },
  noticeTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#92400E',
    marginBottom: 2,
  },
  noticeText: {
    color: '#78350F',
  },
  closingText: {
    marginTop: 18,
    color: '#334155',
  },
  footer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
    color: '#64748B',
    fontSize: 8.5,
  },
})

function formatCurrency(value: number | null | undefined) {
  if (value == null) return 'Estimated value to be shared'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'To be aligned'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'To be aligned'
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function splitParagraphs(value: string | null | undefined) {
  if (!value?.trim()) return []
  return value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function splitLines(value: string | null | undefined) {
  if (!value?.trim()) return []
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim())
}

function getSourceDetails(quotation: Quotation) {
  return {
    name:
      quotation.source_type === 'client'
        ? quotation.client?.name || quotation.client_snapshot_name || null
        : quotation.client_snapshot_name || quotation.lead?.name || null,
    company:
      quotation.source_type === 'client'
        ? quotation.client?.company_name || quotation.client_snapshot_company_name || null
        : quotation.client_snapshot_company_name || quotation.lead?.company_name || null,
    phone:
      quotation.source_type === 'client'
        ? quotation.client?.phone || quotation.client_snapshot_phone || null
        : quotation.client_snapshot_phone || quotation.lead?.phone || null,
    email: quotation.client_snapshot_email || null,
  }
}

function getGreetingParagraphs(recipientName: string) {
  return [
    `Dear ${recipientName},`,
    'Thank you for the opportunity to submit our quotation. Based on the current discussion and the shared business requirements, please find below our proposed scope of work, estimated pricing structure, support coverage, and commercial terms.',
    'This document is intended to present the engagement in a clear and professional format so the scope, pricing model, and expected deliverables can be reviewed with confidence.',
  ]
}

function getSupportItems(support: string | null | undefined) {
  return splitLines(support)
}

function getTermsItems(terms: string | null | undefined, validTill: string | null) {
  void validTill
  return splitLines(terms)
}

function getPricingTypeLabel(pricingType: QuotationRequirement['pricing_type']) {
  if (pricingType === 'fixed') return 'Fixed Cost'
  if (pricingType === 'milestone') return 'Milestone Based'
  return 'Hourly Based'
}

type QuotationPdfDocumentProps = {
  quotation: Quotation
  requirements: QuotationRequirement[]
  subtotal: number
  discount: number
  finalTotal: number
}

export function getQuotationPdfFilename(quotationNumber: string) {
  return `${quotationNumber.replace(/[^A-Za-z0-9_-]+/g, '_')}.pdf`
}

function hasRequirementPricing(requirement: QuotationRequirement) {
  if (requirement.pricing_type === 'fixed') return requirement.amount != null
  if (requirement.pricing_type === 'hourly') return requirement.hourly_rate != null || requirement.estimated_hours != null
  return Boolean(requirement.milestones && requirement.milestones.length > 0)
}

export function QuotationPdfDocument({
  quotation,
  requirements,
  subtotal,
  discount,
  finalTotal,
}: QuotationPdfDocumentProps): React.ReactElement<DocumentProps> {
  const source = getSourceDetails(quotation)
  const greetingParagraphs = getGreetingParagraphs(source.name?.trim() || 'Sir/Madam')
  const supportItems = getSupportItems(quotation.support)
  const termsItems = getTermsItems(quotation.terms, quotation.valid_till)
  const showPreparedFor = [source.name, source.company, source.phone, source.email].some(hasText)
  const showScope = requirements.length > 0
  const pricedRequirements = requirements.filter(hasRequirementPricing)
  const showPricing = pricedRequirements.length > 0 || subtotal > 0 || discount > 0 || finalTotal > 0
  const showSupport = supportItems.length > 0
  const showTerms = termsItems.length > 0
  const showGstNote = showPricing

  return (
    <Document
      title={`${quotation.quotation_number} quotation`}
      author={COMPANY_PROFILE.name}
      subject="Quotation document"
      creator={COMPANY_PROFILE.name}
      producer={COMPANY_PROFILE.name}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeftBlock}>
            <View style={styles.logoWrap}>
              <Image src={SCC_LOGO_PATH} style={{ width: 58, height: 58 }} />
            </View>
            <View>
              <Text style={styles.brandName}>{COMPANY_PROFILE.name}</Text>
              <Text style={styles.brandSubtext}>Think Smart</Text>
            </View>
          </View>

          <View style={styles.headerRightBlock}>
            <Text style={styles.headerAddressText}>349-350, Vikas Shoppers, B/H Filter House Bhagvan Nagar Circle,</Text>
            <Text style={styles.headerAddressText}>near Sarthana Jakat Naka, Nana Varachha,</Text>
            <Text style={styles.headerAddressText}>Surat, Gujarat 395006</Text>
          </View>
        </View>

        <View style={styles.dividerBlue} />

        <View style={styles.quoteMetaRow}>
          <Text style={styles.quoteMetaText}>Quotation No.: {quotation.quotation_number}</Text>
          <Text style={styles.quoteMetaText}>Date: {formatDate(quotation.created_at)}</Text>
        </View>

        <View style={styles.preparedTable}>
          <View style={styles.preparedTableRow}>
            <View style={styles.preparedHeaderCell}>
              <Text style={styles.preparedHeaderText}>Prepared For:</Text>
            </View>
            <View style={[styles.preparedHeaderCell, styles.preparedHeaderCellLast]}>
              <Text style={styles.preparedHeaderText}>Prepared By:</Text>
            </View>
          </View>
          <View style={styles.preparedTableRow}>
            <View style={styles.preparedBodyCell}>
              {hasText(source.name) ? <Text style={styles.preparedBodyPrimary}>{source.name}</Text> : null}
              {hasText(source.company) ? <Text style={styles.preparedBodyText}>({source.company})</Text> : null}
              {hasText(source.phone) ? <Text style={styles.preparedBodyText}>{source.phone}</Text> : null}
              {hasText(source.email) ? <Text style={styles.preparedBodyText}>{source.email}</Text> : null}
            </View>
            <View style={[styles.preparedBodyCell, styles.preparedBodyCellLast]}>
              <Text style={styles.preparedBodyPrimary}>{COMPANY_PROFILE.name}</Text>
              <Text style={styles.preparedBodyText}>{COMPANY_PROFILE.website}</Text>
              <Text style={styles.preparedBodyText}>{COMPANY_PROFILE.email}</Text>
              <Text style={styles.preparedBodyText}>{COMPANY_PROFILE.phone}</Text>
            </View>
          </View>
        </View>

        <View style={styles.introBlock}>
          <Text style={styles.introGreetingLine}>{greetingParagraphs[0]}</Text>
          {greetingParagraphs.slice(1).map((paragraph, index) => (
            <Text key={index} style={styles.introCentered}>
              {paragraph}
            </Text>
          ))}
        </View>

        {showScope ? (
          <View style={styles.contentSection}>
            <Text style={styles.sectionHeading}>Scope of Work:</Text>
            {requirements.map((requirement, index) => (
              <View key={requirement.id} style={styles.requirementCard}>
                <Text style={styles.requirementTitle}>
                  {index + 1}. {requirement.title?.trim() || `Requirement ${index + 1}`}
                </Text>
                {splitParagraphs(requirement.description).map((paragraph, paragraphIndex) => (
                  <View key={paragraphIndex} style={styles.listItemRow}>
                    <Text style={styles.listBullet}>-</Text>
                    <Text style={styles.listText}>{paragraph}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {showPricing ? (
          <View style={styles.contentSection}>
            <Text style={styles.sectionHeading}>Pricing Details:</Text>
            {pricedRequirements.map((requirement, index) => (
              <View key={requirement.id} style={styles.pricingCard}>
                <Text style={styles.pricingTitle}>
                  {index + 1}. {requirement.title?.trim() || `Requirement ${index + 1}`}
                </Text>

                {requirement.pricing_type === 'fixed' && requirement.amount != null ? (
                  <>
                    <Text style={styles.pricingLineLabel}>Estimated Pricing Model</Text>
                    <Text style={styles.pricingLineValue}>Fixed Cost</Text>
                    <Text style={styles.pricingLineLabel}>Estimated Cost</Text>
                    <Text style={styles.pricingLineValue}>{formatCurrency(requirement.amount)}</Text>
                  </>
                ) : null}

                {requirement.pricing_type === 'hourly' ? (
                  <>
                    <Text style={styles.pricingLineLabel}>Estimated Pricing Model</Text>
                    <Text style={styles.pricingLineValue}>Hourly Based</Text>
                    {requirement.hourly_rate != null ? (
                      <>
                        <Text style={styles.pricingLineLabel}>Estimated Hourly Rate</Text>
                        <Text style={styles.pricingLineValue}>{formatCurrency(requirement.hourly_rate)} / hour</Text>
                      </>
                    ) : null}
                    {requirement.estimated_hours != null ? (
                      <>
                        <Text style={styles.pricingLineLabel}>Estimated Hours</Text>
                        <Text style={styles.pricingLineValue}>{requirement.estimated_hours} hours</Text>
                      </>
                    ) : null}
                  </>
                ) : null}

                {requirement.pricing_type === 'milestone' && requirement.milestones && requirement.milestones.length > 0 ? (
                  <View style={styles.milestoneTable}>
                    <View style={styles.milestoneHeaderRow}>
                      <View style={styles.milestoneCellWide}>
                        <Text style={styles.milestoneHeadText}>Milestone</Text>
                      </View>
                      <View style={styles.milestoneCellWide}>
                        <Text style={styles.milestoneHeadText}>Details</Text>
                      </View>
                      <View style={styles.milestoneCell}>
                        <Text style={styles.milestoneHeadText}>Due</Text>
                      </View>
                      <View style={styles.milestoneCell}>
                        <Text style={styles.milestoneHeadText}>Estimated Value</Text>
                      </View>
                    </View>
                    {requirement.milestones.map((milestone, milestoneIndex) => (
                      <View
                        key={milestone.id}
                        style={
                          milestoneIndex === requirement.milestones!.length - 1
                            ? [styles.milestoneRow, { borderBottomWidth: 0 }]
                            : styles.milestoneRow
                        }
                      >
                        <View style={styles.milestoneCellWide}>
                          <Text style={styles.milestoneText}>{milestone.title}</Text>
                        </View>
                        <View style={styles.milestoneCellWide}>
                          <Text style={styles.milestoneText}>{milestone.description?.trim() || '-'}</Text>
                        </View>
                        <View style={styles.milestoneCell}>
                          <Text style={styles.milestoneText}>{formatDate(milestone.due_date)}</Text>
                        </View>
                        <View style={styles.milestoneCell}>
                          <Text style={styles.milestoneText}>{formatCurrency(milestone.amount)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}

            <View style={styles.summaryGrid}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Estimated Subtotal</Text>
                <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
              </View>
              {discount > 0 ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Estimated Discount</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(discount)}</Text>
                </View>
              ) : null}
              <View style={[styles.summaryRow, styles.summaryRowStrong]}>
                <Text style={styles.summaryLabel}>Estimated Project Value</Text>
                <Text style={styles.summaryValue}>{formatCurrency(finalTotal)}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {showSupport ? (
          <View style={styles.contentSection}>
            <Text style={styles.sectionHeading}>Support:</Text>
            <View style={styles.introCard}>
              {supportItems.map((item, index) => (
                <View key={index} style={styles.listItemRow}>
                  <Text style={styles.listBullet}>-</Text>
                  <Text style={styles.listText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {showTerms ? (
          <View style={styles.contentSection}>
            <Text style={styles.sectionHeading}>Terms:</Text>
            <View style={styles.introCard}>
              {termsItems.map((item, index) => (
                <View key={index} style={styles.listItemRow}>
                  <Text style={styles.listBullet}>-</Text>
                  <Text style={styles.listText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {showGstNote ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>Important Tax Note</Text>
            <Text style={styles.noticeText}>{GST_NOTE}</Text>
          </View>
        ) : null}

        <View style={styles.footerBlueLine} />
        <View style={styles.footerContactRow}>
          <Text style={styles.footerWebsite}>{COMPANY_PROFILE.website}</Text>
          <Text style={styles.footerContacts}>{COMPANY_PROFILE.email} | {COMPANY_PROFILE.phone}</Text>
        </View>
      </Page>
    </Document>
  )
}
