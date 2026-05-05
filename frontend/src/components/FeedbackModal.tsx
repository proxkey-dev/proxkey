import React, { useState } from 'react'
import { GlassCard } from './GlassCard'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit?: (feedback: string) => void
  title?: string
  description?: string
  placeholder?: string
  submitText?: string
  skipText?: string
}

type FeedbackCategory = 'ui' | 'keygen' | 'performance' | 'bugs' | 'feature' | 'other'

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title = 'Share Your Feedback',
  description = 'Help us improve ProxKey by sharing your experience',
  placeholder = 'Tell us about your experience...',
  submitText = 'Submit Feedback',
  skipText = 'Cancel',
}) => {
  const [formData, setFormData] = useState({
    whatWentWell: '',
    whatWentWrong: '',
    issues: '',
    consistency: '',
    category: 'ui' as FeedbackCategory,
    additionalComments: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // If onSubmit is provided, use the simple feedback flow
      if (onSubmit) {
        const feedback =
          formData.whatWentWrong || formData.additionalComments || 'No specific feedback provided'
        onSubmit(feedback)
        setIsSubmitted(true)

        // Reset form after 2 seconds
        setTimeout(() => {
          setIsSubmitted(false)
          setFormData({
            whatWentWell: '',
            whatWentWrong: '',
            issues: '',
            consistency: '',
            category: 'ui',
            additionalComments: '',
          })
          onClose()
        }, 2000)
        return
      }

      // Original form submission logic
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error('Failed to submit feedback')
      }

      const result = await response.json()
      console.log('Feedback submitted successfully:', result)
      setIsSubmitted(true)

      // Reset form after 2 seconds
      setTimeout(() => {
        setIsSubmitted(false)
        setFormData({
          whatWentWell: '',
          whatWentWrong: '',
          issues: '',
          consistency: '',
          category: 'ui',
          additionalComments: '',
        })
        onClose()
      }, 2000)
    } catch (error) {
      console.error('Error submitting feedback:', error)
      // You might want to show an error message to the user here
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 min-h-screen">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl mx-auto">
        <GlassCard className="p-8 max-w-2xl mx-auto relative">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-all duration-200"
            aria-label="Close modal"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-display font-bold text-white mb-2">{title}</h2>
            <p className="text-white/70">{description}</p>
          </div>

          {isSubmitted ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Thank you!</h3>
              <p className="text-white/70">Your feedback has been submitted successfully.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Show simplified form for error feedback */}
              {onSubmit ? (
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    What were you doing when this error occurred?
                  </label>
                  <textarea
                    name="whatWentWrong"
                    value={formData.whatWentWrong}
                    onChange={handleInputChange}
                    placeholder={placeholder}
                    rows={4}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    required
                  />
                </div>
              ) : (
                <>
                  {/* Category Selection */}
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      What area would you like to provide feedback on?
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="ui">User Interface</option>
                      <option value="keygen">Key Generation</option>
                      <option value="performance">Performance</option>
                      <option value="bugs">Bugs & Issues</option>
                      <option value="feature">Feature Request</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* What went well */}
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      What went well? <span className="text-white/50">(Optional)</span>
                    </label>
                    <textarea
                      name="whatWentWell"
                      value={formData.whatWentWell}
                      onChange={handleInputChange}
                      placeholder="Tell us about the positive aspects of your experience..."
                      rows={3}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* What went wrong */}
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      What went wrong? <span className="text-white/50">(Optional)</span>
                    </label>
                    <textarea
                      name="whatWentWrong"
                      value={formData.whatWentWrong}
                      onChange={handleInputChange}
                      placeholder="Describe any issues or problems you encountered..."
                      rows={3}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Specific issues */}
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Specific issues or bugs <span className="text-white/50">(Optional)</span>
                    </label>
                    <textarea
                      name="issues"
                      value={formData.issues}
                      onChange={handleInputChange}
                      placeholder="Describe any specific bugs, errors, or technical issues..."
                      rows={3}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* UI/Keygen consistency */}
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      How consistent is the UI and key generation experience?{' '}
                      <span className="text-white/50">(Optional)</span>
                    </label>
                    <textarea
                      name="consistency"
                      value={formData.consistency}
                      onChange={handleInputChange}
                      placeholder="Rate the consistency of the user interface and key generation process..."
                      rows={3}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Additional comments */}
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Additional comments <span className="text-white/50">(Optional)</span>
                    </label>
                    <textarea
                      name="additionalComments"
                      value={formData.additionalComments}
                      onChange={handleInputChange}
                      placeholder="Any other thoughts or suggestions..."
                      rows={3}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                </>
              )}

              {/* Submit button */}
              <div className="flex justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white transition-all duration-200"
                >
                  {skipText}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 flex items-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>{submitText}</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </GlassCard>
      </div>
    </div>
  )
}
